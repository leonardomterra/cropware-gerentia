-- gerentia.app — Recorrências com projeção futura + valor médio (estimado).
--
-- Muda o modelo de geração: em vez de gerar 1 lançamento 1 dia antes do
-- vencimento, materializa uma fila de lançamentos PREVISTOS (is_estimated=true)
-- nos meses futuros assim que a recorrência é criada/ativada — pro usuário se
-- programar. Cada previsto nasce com o "valor médio" da recorrência; o usuário
-- pode editar o valor real em cada mês (isso vira is_estimated=false).
--
-- Janela:
--   - Indeterminada (end_date null): rolante de ROLL meses, topada pelo cron.
--   - Finita (end_date setado): materializa do mês corrente até end_date.
-- Idempotência: existência de linha por (recurring_id, mês de transaction_date).
--
-- Objetos seguem nomeados farm_* (o rebrand não renomeia objetos de banco).

-- 1. Flag ortogonal de "previsto" (não mexe na máquina de status).
alter table public.farm_receipts
  add column if not exists is_estimated boolean not null default false;

create index if not exists farm_receipts_recurring_estimated_idx
  on public.farm_receipts(recurring_id, transaction_date)
  where is_estimated = true;

-- 2. Fim da recorrência (null = indeterminada).
alter table public.farm_recurring_receipts
  add column if not exists end_date date;

-- 3. Materializa os previstos de UMA recorrência (idempotente).
--    p_roll = quantos meses à frente projetar quando a recorrência é
--    indeterminada (end_date null). Recorrência finita ignora p_roll e vai
--    até end_date. Retorna quantas linhas foram criadas.
create or replace function public.farm_recurring_materialize_one(
  p_recurring_id uuid,
  p_roll int default 12
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.farm_recurring_receipts%rowtype;
  v_base date;
  v_end_month date;
  v_count int;
  v_target_month date;
  v_target date;
  v_last date := null;
  m int;
  cnt int := 0;
begin
  select * into rec from public.farm_recurring_receipts where id = p_recurring_id;
  if not found or not rec.active then
    return 0;
  end if;

  v_base := date_trunc('month', current_date)::date;

  if rec.end_date is null then
    v_count := p_roll;
  else
    v_end_month := date_trunc('month', rec.end_date)::date;
    v_count := ((extract(year from v_end_month) - extract(year from v_base))::int * 12
             + (extract(month from v_end_month) - extract(month from v_base))::int) + 1;
  end if;

  m := 0;
  while m <= v_count - 1 loop
    v_target_month := (v_base + make_interval(months => m))::date;
    v_target := (v_target_month + make_interval(days => rec.day_of_month - 1))::date;

    if not exists (
      select 1 from public.farm_receipts fr
      where fr.recurring_id = rec.id
        and fr.transaction_date is not null
        and date_trunc('month', fr.transaction_date) = v_target_month
    ) then
      insert into public.farm_receipts (
        organization_id, created_by, cost_center_id, doc_type, direction, status,
        total_value, currency, transaction_date, due_date,
        vendor, payment_method, description, category, source, recurring_id, is_estimated
      ) values (
        rec.organization_id, rec.created_by, rec.cost_center_id, 'outro', rec.direction,
        case when rec.direction = 'income' then 'a_receber' else 'a_pagar' end,
        rec.total_value, 'BRL', v_target, v_target,
        rec.vendor, rec.payment_method,
        coalesce(rec.description, rec.name) || ' (recorrente)',
        rec.category, 'recurring', rec.id, true
      );
      cnt := cnt + 1;
    end if;

    v_last := v_target;
    m := m + 1;
  end loop;

  -- next_run_date vira informativo: até onde a fila foi projetada ("Projetado até").
  if v_last is not null then
    update public.farm_recurring_receipts
      set next_run_date = v_last, updated_at = now()
      where id = rec.id;
  end if;

  return cnt;
end;
$$;

-- 4. Re-sincroniza valor/categoria/etc. nos previstos FUTUROS (mês corrente em
--    diante). Não toca confirmados (is_estimated=false) nem o passado. Não move
--    datas (mudança de dia/fim usa cleanup+materialize).
create or replace function public.farm_recurring_resync_estimated(
  p_recurring_id uuid
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.farm_recurring_receipts%rowtype;
  cnt int := 0;
begin
  select * into rec from public.farm_recurring_receipts where id = p_recurring_id;
  if not found then
    return 0;
  end if;

  update public.farm_receipts fr
    set total_value = rec.total_value,
        category = rec.category,
        vendor = rec.vendor,
        cost_center_id = rec.cost_center_id,
        payment_method = rec.payment_method,
        direction = rec.direction,
        status = case when rec.direction = 'income' then 'a_receber' else 'a_pagar' end,
        description = coalesce(rec.description, rec.name) || ' (recorrente)',
        updated_at = now()
    where fr.recurring_id = rec.id
      and fr.is_estimated = true
      and fr.transaction_date is not null
      and date_trunc('month', fr.transaction_date) >= date_trunc('month', current_date);

  get diagnostics cnt = row_count;
  return cnt;
end;
$$;

-- 5. Remove os previstos FUTUROS de uma recorrência (pausa/exclusão/mudança de
--    dia ou fim). Mantém confirmados/pagos e o passado.
create or replace function public.farm_recurring_cleanup_estimated(
  p_recurring_id uuid
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  cnt int := 0;
begin
  delete from public.farm_receipts fr
    where fr.recurring_id = p_recurring_id
      and fr.is_estimated = true
      and fr.transaction_date is not null
      and date_trunc('month', fr.transaction_date) >= date_trunc('month', current_date);

  get diagnostics cnt = row_count;
  return cnt;
end;
$$;

-- 6. Processa todas as ativas (cron diário). Mantém a assinatura sem args
--    válida (default no p_roll) pra o cron 'farm-process-recurring' continuar
--    chamando `select public.farm_process_recurring();`.
drop function if exists public.farm_process_recurring();

create or replace function public.farm_process_recurring(
  p_roll int default 12
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  cnt int := 0;
begin
  for rec in
    select id from public.farm_recurring_receipts where active = true
  loop
    cnt := cnt + public.farm_recurring_materialize_one(rec.id, p_roll);
  end loop;
  return cnt;
end;
$$;

-- Apenas service_role (a edge orquestra com o client admin). NAO conceder a
-- 'authenticated': cleanup/resync mexem em farm_receipts por recurring_id e,
-- via PostgREST, um usuario logado poderia atingir recorrencias de outra org.
-- O cron roda como o owner (postgres), independente desses grants.
grant execute on function public.farm_recurring_materialize_one(uuid, int) to service_role;
grant execute on function public.farm_recurring_resync_estimated(uuid) to service_role;
grant execute on function public.farm_recurring_cleanup_estimated(uuid) to service_role;
grant execute on function public.farm_process_recurring(int) to service_role;

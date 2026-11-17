-- Unificação Flag Field → gerentia, fase 5: NDVI (teto mensal) e anexos do campo.
-- Ver docs/UNIFICACAO-FIELD.md e o plano da fase 5.

-- ============================================================
-- 1. Teto de NDVI por organização (decisão de 16/11/2026: sem plano, só o
--    módulo Field; 120 imagens/mês por org, conferido no servidor).
-- ============================================================
create table public.farm_ndvi_uso (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes date not null,            -- sempre o dia 1 do mês
  total integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (organization_id, mes)
);
-- Só o service_role mexe (a edge, depois de conferir quem pede).
alter table public.farm_ndvi_uso enable row level security;

-- Conta UMA imagem e diz se podia. CORRIGE o bug do Flag Field (0017): lá o
-- total travava no teto e `permitido = total <= teto` dava true para sempre.
-- Aqui `permitido` olha o valor ANTERIOR, e o total só sobe se havia saldo.
create or replace function public.farm_registrar_uso_ndvi(p_org uuid, p_teto integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $f$
declare
  v_mes date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_antes integer;
begin
  insert into public.farm_ndvi_uso (organization_id, mes, total)
  values (p_org, v_mes, 0)
  on conflict (organization_id, mes) do nothing;

  select total into v_antes from public.farm_ndvi_uso
   where organization_id = p_org and mes = v_mes
   for update;

  if v_antes >= p_teto then
    return jsonb_build_object('permitido', false, 'usado', v_antes, 'teto', p_teto);
  end if;

  update public.farm_ndvi_uso
     set total = v_antes + 1, atualizado_em = now()
   where organization_id = p_org and mes = v_mes;
  return jsonb_build_object('permitido', true, 'usado', v_antes + 1, 'teto', p_teto);
end;
$f$;

create or replace function public.farm_uso_ndvi_no_mes(p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $f$
  select coalesce((
    select total from public.farm_ndvi_uso
     where organization_id = p_org
       and mes = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
  ), 0);
$f$;

revoke execute on function public.farm_registrar_uso_ndvi(uuid, integer) from public, anon, authenticated;
revoke execute on function public.farm_uso_ndvi_no_mes(uuid) from public, anon, authenticated;
grant execute on function public.farm_registrar_uso_ndvi(uuid, integer) to service_role;
grant execute on function public.farm_uso_ndvi_no_mes(uuid) to service_role;

-- ============================================================
-- 2. Anexos (fotos/arquivos) das atividades e das avaliações de ensaio.
--    Os arquivos ficam no R2 privado (mesmo balde dos lançamentos), na pasta
--    org-<org>/campo/...; aqui só a lista: [{key, nome, mime, tamanho}].
-- ============================================================
alter table public.farm_activities
  add column if not exists attachments jsonb not null default '[]'::jsonb
  check (jsonb_typeof(attachments) = 'array');
alter table public.farm_trial_evaluations
  add column if not exists attachments jsonb not null default '[]'::jsonb
  check (jsonb_typeof(attachments) = 'array');

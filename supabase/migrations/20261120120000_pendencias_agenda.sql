-- Unificação Flag Field → gerentia, fase 3: a Agenda do Flag Field entra nas
-- Pendências. Ver docs/UNIFICACAO-FIELD.md e o plano da fase 3.
--
-- Decisão: agenda = pendência com data. Em vez de uma tabela de eventos ao lado,
-- farm_tasks ganha hora, tipo, local e o vínculo a fazenda/talhão. Operação de
-- campo planejada (aplicação, colheita...) continua sendo ATIVIDADE planejada
-- (farm_activities), por isso os tipos daqui são poucos: os 13 do Flag Field se
-- sobrepunham.
--
-- RLS, cron de lembrete e restauração de backup não mudam (a tabela já está
-- em todos).

alter table public.farm_tasks
  add column if not exists due_time time,
  add column if not exists kind text not null default 'lembrete',
  add column if not exists location text,
  add column if not exists farm_id uuid references public.farms(id) on delete set null,
  add column if not exists plot_id uuid references public.farm_plots(id) on delete set null;

alter table public.farm_tasks
  add constraint farm_tasks_kind_check
  check (kind in ('lembrete','reuniao','visita','deslocamento','manutencao','outro'));

create index if not exists farm_tasks_farm_idx on public.farm_tasks (farm_id);
create index if not exists farm_tasks_plot_idx on public.farm_tasks (plot_id);

comment on column public.farm_tasks.kind is
  'Tipo do compromisso: lembrete | reuniao | visita | deslocamento | manutencao | outro.';

-- O talhão traz a fazenda junto; os dois da mesma org (padrão farm_activities_check).
create or replace function public.farm_tasks_check_vinculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $f$
declare
  v_farm uuid;
begin
  if new.plot_id is not null then
    select p.farm_id into v_farm from public.farm_plots p
     where p.id = new.plot_id and p.organization_id = new.organization_id;
    if v_farm is null then
      raise exception 'O talhao da pendencia nao pertence a organizacao.';
    end if;
    new.farm_id := v_farm;
  end if;
  if new.farm_id is not null and not exists (
    select 1 from public.farms f
     where f.id = new.farm_id and f.organization_id = new.organization_id
  ) then
    raise exception 'A fazenda da pendencia nao pertence a organizacao.';
  end if;
  return new;
end;
$f$;
revoke execute on function public.farm_tasks_check_vinculo() from public, anon, authenticated;

create trigger farm_tasks_check_vinculo
  before insert or update of farm_id, plot_id, organization_id on public.farm_tasks
  for each row execute function public.farm_tasks_check_vinculo();

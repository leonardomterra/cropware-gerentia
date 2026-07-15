-- Cropware Gerentia - modulo Pendencias/To-Do: tabela farm_tasks.
-- Tarefas livres do usuario (titulo, data opcional, feito/nao-feito, prioridade).
-- Pessoais: o handler lista por created_by; RLS org-scoped (padrao da casa,
-- igual farm_receipts). created_by e obrigatorio (a resolucao de telefone do
-- lembrete proativo da Etapa 2b usa created_by -> farm_whatsapp_links).

create table public.farm_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),

  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  priority text not null default 'normal' check (priority in ('low','normal','high')),

  -- Dedup do lembrete proativo (Etapa 2b): setado quando o cron ja avisou.
  reminded_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index farm_tasks_org_open_idx on public.farm_tasks(organization_id) where done = false;
create index farm_tasks_org_due_idx on public.farm_tasks(organization_id, due_date) where due_date is not null;

alter table public.farm_tasks enable row level security;

create policy "tasks scoped to org" on public.farm_tasks
  for all using (
    organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.farm_tasks to authenticated;

-- Reusa a funcao existente public.farm_set_updated_at() (nao recria).
create trigger farm_tasks_set_updated_at
before update on public.farm_tasks
for each row execute function public.farm_set_updated_at();

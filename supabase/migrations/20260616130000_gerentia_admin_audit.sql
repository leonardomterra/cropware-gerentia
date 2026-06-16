-- Trilha de auditoria das ações sensíveis do painel MASTER.
--
-- Impersonation (um master assume a sessão de outro usuário) é a ação mais
-- crítica do app: dá acesso total aos dados de terceiros. Sem registro, não há
-- como saber quem entrou na conta de quem, nem quando. Esta tabela é
-- append-only do ponto de vista da aplicação (só a edge function/service_role
-- escreve) e serve também pra outras ações (delete, reset de senha, suspend).
create table if not exists public.farm_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  detail jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- RLS ligado + ZERO policies => nega anon/authenticated por completo.
-- Só o service_role (edge function) escreve e lê — clientes nunca tocam.
alter table public.farm_admin_audit enable row level security;

create index if not exists farm_admin_audit_created_idx
  on public.farm_admin_audit (created_at desc);
create index if not exists farm_admin_audit_target_idx
  on public.farm_admin_audit (target_user_id);
create index if not exists farm_admin_audit_actor_idx
  on public.farm_admin_audit (actor_user_id);

-- Cropware Farm V1 - migration 1/5: organizations
-- Aplicada via Supabase MCP em 2026-05-20. Ver memoria project_farm_supabase.md.
-- Policy de SELECT vive em 20260520191313_farm_init_users_meta.sql (forward-ref).

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  type text not null default 'farm',
  plan_code text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz default now()
);

alter table public.organizations enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.organizations to authenticated;

-- Cropware Farm - categorias custom por usuario + ocultacao de preset por org.
--
-- Decisao 2026-05-30 (Fase B do gerenciador de categorias):
-- - Categoria CUSTOM e' por USUARIO (created_by_user_id). So quem criou ve.
-- - DESATIVAR preset e' por ORG: tabela farm_category_hidden esconde o
--   preset (global, compartilhado) pra aquela org sem alterar o preset.
--
-- Tudo via RLS client-side (supabase-js direto, igual useCategories ja le).
-- Sem edge function nova.

-- 1. coluna pra categoria custom (NULL nos presets)
alter table public.farm_categories
  add column if not exists created_by_user_id uuid references auth.users(id) on delete cascade;

-- 2. tabela de ocultacao por org (esconde preset que a org nao usa)
create table if not exists public.farm_category_hidden (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null references public.farm_categories(id) on delete cascade,
  hidden_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  primary key (organization_id, category_id)
);

alter table public.farm_category_hidden enable row level security;

-- hidden: membros da org leem; owner/admin escrevem.
create policy "cat_hidden read by org" on public.farm_category_hidden
  for select using (
    organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

create policy "cat_hidden write by admins" on public.farm_category_hidden
  for all using (
    exists (
      select 1 from public.users_meta
      where user_id = auth.uid()
        and organization_id = farm_category_hidden.organization_id
        and role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.users_meta
      where user_id = auth.uid()
        and organization_id = farm_category_hidden.organization_id
        and role in ('owner','admin')
    )
  );

grant select, insert, update, delete on public.farm_category_hidden to authenticated;

-- 3. RLS de farm_categories reescrita pra cobrir custom do user.
--    (subqueries so em users_meta, nunca na propria tabela - evita recursao.)
drop policy if exists "categories org or preset" on public.farm_categories;
drop policy if exists "categories write own org" on public.farm_categories;

-- SELECT: presets globais + custom do proprio user + legado scoped-to-org.
create policy "categories select" on public.farm_categories
  for select using (
    is_preset = true
    or created_by_user_id = auth.uid()
    or organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

-- INSERT: user so cria custom pra si (nunca preset).
create policy "categories insert own" on public.farm_categories
  for insert with check (
    created_by_user_id = auth.uid()
    and is_preset = false
  );

-- UPDATE: so as proprias custom.
create policy "categories update own" on public.farm_categories
  for update using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

-- DELETE: so as proprias custom.
create policy "categories delete own" on public.farm_categories
  for delete using (created_by_user_id = auth.uid());

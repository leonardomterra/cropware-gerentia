-- Gerentia - grupos de categoria gerenciaveis pela org + escopo org nas custom.
--
-- Decisao 2026-08-19: ate aqui o "grupo" (Escritorio, Fazenda, Pessoal...) era
-- so um texto solto em farm_categories.group_name, vindo dos presets globais.
-- A org nao tinha como renomear, criar, ocultar nem excluir grupo - so as
-- categorias soltas dentro dele. Cliente com plano de contas proprio (revenda
-- de maquinas) precisa exatamente disso.
--
-- Duas mudancas:
--
-- 1. CATEGORIA CUSTOM VIRA DA ORG (era do usuario). O modelo antigo
--    (created_by_user_id + RLS individual, migration 20260530190000) fazia a
--    categoria criada por um usuario ficar invisivel pro resto do time - o que
--    quebra org multiusuario. Agora e' igual farm_cost_centers: membro le,
--    owner/admin escreve. created_by_user_id fica so como autoria/auditoria.
--    Seguro de aplicar: hoje ha 0 categorias custom no banco (so os 53 presets),
--    entao nao ha dado a migrar nem usuario que perde acesso.
--
-- 2. GRUPO VIRA LINHA (farm_category_groups), sempre por org e sempre opcional:
--    - grupo preset SEM linha  -> aparece com o nome canonico (comportamento atual)
--    - grupo preset COM linha  -> a org renomeou e/ou ocultou (is_custom = false)
--    - grupo criado pela org   -> is_custom = true, pode ser excluido
--    group_key e' a CHAVE ESTAVEL e e' o que farm_categories.group_name guarda.
--    Renomear mexe so em `name`, entao nenhuma categoria precisa ser reapontada.

-- ---------------------------------------------------------------- categorias

-- Codigo contabil do plano de contas do cliente (462, 1002, 3.11.01.03...).
-- Opcional: preset e org que nao usam contabilidade deixam null.
alter table public.farm_categories
  add column if not exists code text;

-- RLS reescrita: custom passa a ser da ORG, nao do usuario.
drop policy if exists "categories select" on public.farm_categories;
drop policy if exists "categories insert own" on public.farm_categories;
drop policy if exists "categories update own" on public.farm_categories;
drop policy if exists "categories delete own" on public.farm_categories;

-- SELECT: presets globais + tudo da org do usuario.
create policy "categories select" on public.farm_categories
  for select using (
    is_preset = true
    or organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: so owner/admin da propria org, e nunca preset.
-- (mesmo shape de farm_cost_centers - subquery so em users_meta, sem recursao.)
create policy "categories write by admins" on public.farm_categories
  for all using (
    is_preset = false
    and exists (
      select 1 from public.users_meta
      where user_id = auth.uid()
        and organization_id = farm_categories.organization_id
        and role in ('owner', 'admin')
    )
  ) with check (
    is_preset = false
    and exists (
      select 1 from public.users_meta
      where user_id = auth.uid()
        and organization_id = farm_categories.organization_id
        and role in ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------------- grupos

create table if not exists public.farm_category_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- chave estavel: nos presets e' o group_name canonico ('Escritorio');
  -- nos grupos da org e' um id opaco ('grp_ab12cd34'). NUNCA muda no rename.
  group_key text not null,
  -- rotulo exibido. E' o unico campo que o rename altera.
  name text not null,
  -- desativado: some do seletor de lancamento e do agente do WhatsApp,
  -- mas continua em Configuracoes (esmaecido) pra poder reativar.
  hidden boolean not null default false,
  -- ordem de exibicao. Grupo sem linha entra com 100 e cai na ordem alfabetica.
  sort_order integer not null default 100,
  -- true = grupo criado pela org (pode ser excluido).
  -- false = override de grupo preset (so renomeia/oculta).
  is_custom boolean not null default true,
  -- codigo contabil do grupo, quando o cliente usa plano de contas.
  code text,
  -- aba em que o grupo foi criado ('expense' | 'income'). So serve pra um
  -- grupo VAZIO saber onde aparecer; assim que tem categoria dentro, quem
  -- manda e' a direction das categorias. Null = aparece nas duas.
  direction text check (direction in ('expense', 'income')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (organization_id, group_key)
);

-- Dois grupos com o mesmo rotulo na mesma org viram duas secoes identicas na
-- tela. Barra no banco; a UI ainda checa antes pra dar erro legivel.
create unique index if not exists farm_category_groups_org_name_uniq
  on public.farm_category_groups (organization_id, lower(name));

create index if not exists farm_category_groups_org_idx
  on public.farm_category_groups (organization_id);

alter table public.farm_category_groups enable row level security;

create policy "cat_groups read by org members" on public.farm_category_groups
  for select using (
    organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

create policy "cat_groups write by admins" on public.farm_category_groups
  for all using (
    exists (
      select 1 from public.users_meta
      where user_id = auth.uid()
        and organization_id = farm_category_groups.organization_id
        and role in ('owner', 'admin')
    )
  ) with check (
    exists (
      select 1 from public.users_meta
      where user_id = auth.uid()
        and organization_id = farm_category_groups.organization_id
        and role in ('owner', 'admin')
    )
  );

grant select, insert, update, delete on public.farm_category_groups to authenticated;

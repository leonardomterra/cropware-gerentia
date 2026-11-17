-- Módulos de CORTESIA por organização (17/11/2026).
--
-- Para liberar um módulo a uma org sem plano nem trial: o Leonardo vendo o
-- Field na própria conta antes do lançamento, e depois testadores. Até aqui o
-- direito vinha só de (a) trial vigente → todos os módulos ou (b) assinatura
-- ativa → o módulo do plano. A cortesia é a terceira fonte, somada às outras.
--
-- 1) organizations.modulos_cortesia — lista de módulos dados de graça. Vazia
--    por padrão; só o banco (SQL / painel) escreve nela, não há rota de API.
-- 2) farm_org_modules() passa a incluir a cortesia. Corpo copiado de
--    20261117120000_modulos_e_modo_de_uso.sql (conferido igual ao de produção
--    em 17/11/2026); a única mudança é o terceiro ramo do union.
--
-- Todos os pontos de direito passam por farm_org_modules(): /auth/me, o
-- /billing/subscription, o requireModule das rotas do Field e as RLS das
-- tabelas do Field. Nada mais a mudar.

-- ============================================================
-- 1. organizations.modulos_cortesia
-- ============================================================
alter table public.organizations
  add column if not exists modulos_cortesia text[] not null default '{}';

alter table public.organizations
  add constraint organizations_modulos_cortesia_check
  check (modulos_cortesia <@ array['financas', 'field']::text[]);

comment on column public.organizations.modulos_cortesia is
  'Módulos liberados de cortesia (sem plano nem trial): financas | field. Somados em farm_org_modules().';

-- ============================================================
-- 2. farm_org_modules() — + cortesia
-- ============================================================
create or replace function public.farm_org_modules()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct m order by m), '{}'::text[])
  from (
    select unnest(array['financas', 'field']) as m
    from public.organizations o
    where o.id = public.farm_current_org_id()
      and o.trial_ends_at > now()
    union
    select coalesce(p.module, 'financas')
    from public.subscriptions s
    left join public.plans p on p.code = s.plan_code
    where s.organization_id = public.farm_current_org_id()
      and s.status = 'active'
    union
    select unnest(o.modulos_cortesia)
    from public.organizations o
    where o.id = public.farm_current_org_id()
  ) x;
$$;

revoke execute on function public.farm_org_modules() from public, anon;
grant execute on function public.farm_org_modules() to authenticated;

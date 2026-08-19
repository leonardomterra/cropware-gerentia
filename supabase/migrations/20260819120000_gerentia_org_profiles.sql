-- gerentia.app — organizações multiusuário: visibilidade por PROPRIEDADE do registro.
-- Etapa 1 de docs/ORGANIZACOES-E-PERFIS.md.
--
-- O que muda: a separação de dados dentro da org deixa de ser "centro de custo" e
-- passa a ser "quem lançou".
--   owner/admin (gestor) e viewer (convidado) leem a organização inteira;
--   member (usuário) lê só o que criou;
--   ninguém edita registro de terceiro (interruptor: farm_can_write_others);
--   viewer não escreve nada.
--
-- Seguro em produção: hoje nenhuma org tem 2+ usuários (os 9 são owner), então
-- para a base atual as policies novas são equivalentes às antigas.
--
-- Corrige de passagem 3 problemas das policies antigas:
--   a) FOR ALL sem WITH CHECK => dava pra inserir registro com created_by de outro;
--   b) users_meta legível pela org inteira (nome/telefone/CPF dos colegas);
--   c) "admin updates members" com EXISTS em users_meta dentro da própria policy
--      => RLS recursivo (mesmo bug já corrigido no SELECT em 20260528140000).

-- ============================================================
-- 1. organizations: avulso (individual) x empresa (company)
-- ============================================================
alter table public.organizations
  add column if not exists kind text not null default 'individual',
  add column if not exists seats_limit integer;

alter table public.organizations drop constraint if exists organizations_kind_check;
alter table public.organizations
  add constraint organizations_kind_check check (kind in ('individual', 'company'));

comment on column public.organizations.kind is
  'individual = assinante avulso (1 usuário). company = organização com equipe.';
comment on column public.organizations.seats_limit is
  'Teto de usuários da org (null = 1). Cobrança de equipe é contratual por ora — ver docs/ORGANIZACOES-E-PERFIS.md §3.';

-- ============================================================
-- 2. users_meta / convites: novo papel viewer (convidado)
-- ============================================================
alter table public.users_meta drop constraint if exists users_meta_role_check;
alter table public.users_meta
  add constraint users_meta_role_check check (role in ('owner', 'admin', 'member', 'viewer'));

alter table public.farm_org_invites drop constraint if exists farm_org_invites_role_check;
alter table public.farm_org_invites
  add constraint farm_org_invites_role_check check (role in ('admin', 'member', 'viewer'));

-- ============================================================
-- 3. Funções de papel (SECURITY DEFINER: bypassam RLS, sem recursão)
-- ============================================================
create or replace function public.farm_current_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.users_meta where user_id = auth.uid() limit 1;
$$;

-- Quem enxerga a organização inteira: gestor (owner/admin) e convidado (viewer).
create or replace function public.farm_can_read_all()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.farm_current_role(), '') in ('owner', 'admin', 'viewer');
$$;

-- Quem pode escrever alguma coisa: todos menos o convidado.
create or replace function public.farm_can_write()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.farm_current_role(), '') in ('owner', 'admin', 'member');
$$;

-- INTERRUPTOR: hoje o gestor NÃO edita lançamento de terceiro (decisão de produto).
-- Pra habilitar, trocar o corpo por:
--   select coalesce(public.farm_current_role(), '') in ('owner', 'admin');
create or replace function public.farm_can_write_others()
returns boolean language sql stable security definer set search_path = '' as $$
  select false;
$$;

comment on function public.farm_can_write_others() is
  'Gestor edita registro de terceiro? Hoje false por decisão de produto — ver docs/ORGANIZACOES-E-PERFIS.md §2.';

-- Dono do lançamento pai, sem depender da RLS de farm_receipts (itens herdam o dono).
create or replace function public.farm_receipt_is_mine(p_receipt_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.farm_receipts r
    where r.id = p_receipt_id and r.created_by = auth.uid()
  );
$$;

-- ============================================================
-- 4. farm_receipts — a tabela central
-- ============================================================
drop policy if exists "receipts scoped by role and cc" on public.farm_receipts;

create policy "receipts read own or manager" on public.farm_receipts
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );

create policy "receipts insert own" on public.farm_receipts
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
  );

create policy "receipts update own" on public.farm_receipts
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  );

create policy "receipts delete own" on public.farm_receipts
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  );

create index if not exists farm_receipts_org_creator_idx
  on public.farm_receipts(organization_id, created_by);

-- ============================================================
-- 5. farm_receipt_items — herdam o dono do lançamento pai
-- ============================================================
drop policy if exists "receipt items scoped by role and cc" on public.farm_receipt_items;

create policy "receipt items read via parent" on public.farm_receipt_items
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or public.farm_receipt_is_mine(receipt_id))
  );

create policy "receipt items insert via parent" on public.farm_receipt_items
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (public.farm_receipt_is_mine(receipt_id) or public.farm_can_write_others())
  );

create policy "receipt items update via parent" on public.farm_receipt_items
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (public.farm_receipt_is_mine(receipt_id) or public.farm_can_write_others())
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (public.farm_receipt_is_mine(receipt_id) or public.farm_can_write_others())
  );

create policy "receipt items delete via parent" on public.farm_receipt_items
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (public.farm_receipt_is_mine(receipt_id) or public.farm_can_write_others())
  );

-- ============================================================
-- 6. farm_tasks (Pendências)
-- ============================================================
drop policy if exists "tasks scoped to org" on public.farm_tasks;

create policy "tasks read own or manager" on public.farm_tasks
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );

create policy "tasks insert own" on public.farm_tasks
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
  );

create policy "tasks update own" on public.farm_tasks
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  );

create policy "tasks delete own" on public.farm_tasks
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  );

-- ============================================================
-- 7. farm_recurring_receipts (Recorrências)
--    created_by era nullable; hoje não há linha órfã (verificado), então fixa.
-- ============================================================
update public.farm_recurring_receipts rr
set created_by = (
  select um.user_id from public.users_meta um
  where um.organization_id = rr.organization_id and um.role = 'owner'
  order by um.created_at limit 1
)
where rr.created_by is null;

-- Se ainda sobrar linha sem dono (org sem owner), aborta em vez de apagar dado.
do $$
begin
  if exists (select 1 from public.farm_recurring_receipts where created_by is null) then
    raise exception 'recorrencia sem created_by e sem owner na org - resolver antes de aplicar';
  end if;
end $$;

alter table public.farm_recurring_receipts alter column created_by set not null;

drop policy if exists "recurring read by org members" on public.farm_recurring_receipts;
drop policy if exists "recurring write by admins" on public.farm_recurring_receipts;

create policy "recurring read own or manager" on public.farm_recurring_receipts
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );

create policy "recurring insert own" on public.farm_recurring_receipts
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
  );

create policy "recurring update own" on public.farm_recurring_receipts
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  );

create policy "recurring delete own" on public.farm_recurring_receipts
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  );

-- ============================================================
-- 8. users_meta — lista da equipe é do gestor, não de todo mundo
--    (antes: qualquer membro lia nome/telefone/CPF dos colegas)
-- ============================================================
drop policy if exists "members read same org" on public.users_meta;

create policy "managers read members" on public.users_meta
  for select using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_read_all()
  );

-- Reescreve o USING sem EXISTS recursivo + permite atribuir viewer.
drop policy if exists "admin updates members" on public.users_meta;

create policy "admin updates members" on public.users_meta
  for update using (
    organization_id = public.farm_current_org_id()
    and coalesce(public.farm_current_role(), '') in ('owner', 'admin')
  ) with check (
    organization_id = public.farm_current_org_id()
    and role in ('admin', 'member', 'viewer')
  );

-- ============================================================
-- 9. farm_cost_centers — centro de custo volta a ser classificação.
--    Convidado não cria/edita CC (antes: qualquer owner/admin; viewer não existia).
-- ============================================================
-- (a policy "cc write by admins" já exige owner/admin, e viewer não está nela —
--  nada a fazer aqui. Registrado para o leitor não achar que foi esquecido.)

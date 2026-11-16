-- Unificação Flag Field → gerentia, fase 0: a fundação dos módulos.
-- Ver docs/UNIFICACAO-FIELD.md.
--
-- 1) plans.module: cada plano pertence a um módulo (financas | field). Os planos
--    de hoje são todos do Finanças.
-- 2) users_meta.field_mode: o "modo de uso" do Field. 'consultor' = atende vários
--    produtores (o app mostra o nível Produtores); 'fazenda' ou NULL = cuida da
--    própria fazenda (o nível fica escondido). Escolhido no cadastro, editável na
--    Conta e pelo master.
-- 3) farm_org_modules(): os módulos liberados para a org de quem chama. É a fonte
--    de verdade do /auth/me e, na fase 1, das RLS das tabelas do Field.
-- 4) handle_new_farm_user: grava o field_mode do cadastro. Corpo copiado de
--    20260819130000_gerentia_org_admin.sql (conferido igual ao de produção em
--    16/11/2026); a única mudança é o field_mode.
-- 5) RLS de farms: a policy única (FOR ALL, sem olhar papel) deixava até o
--    convidado escrever. Passa ao padrão dos helpers.

-- ============================================================
-- 1. plans.module
-- ============================================================
alter table public.plans
  add column if not exists module text not null default 'financas';

alter table public.plans
  add constraint plans_module_check check (module in ('financas', 'field'));

comment on column public.plans.module is
  'Módulo que o plano libera: financas | field. Ver farm_org_modules().';

-- ============================================================
-- 2. users_meta.field_mode
-- ============================================================
alter table public.users_meta
  add column if not exists field_mode text;

alter table public.users_meta
  add constraint users_meta_field_mode_check
  check (field_mode is null or field_mode in ('fazenda', 'consultor'));

comment on column public.users_meta.field_mode is
  'Modo de uso do Field: consultor (atende vários produtores — mostra o nível Produtores) | fazenda. NULL = fazenda.';

-- ============================================================
-- 3. farm_org_modules()
-- ============================================================
-- Regra (a mesma do /billing/subscription, agora por módulo):
--   * trial da org vigente      → todos os módulos;
--   * assinatura com status 'active' → o módulo do plano dela.
-- LEFT JOIN + coalesce: assinatura cujo plan_code não existe em `plans` (produto
-- da loja com código diferente, por exemplo) conta como Finanças — o único
-- módulo que existia antes desta migration. Assim ninguém que paga perde acesso
-- por um detalhe de cadastro de plano.
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
  ) x;
$$;

revoke execute on function public.farm_org_modules() from public, anon;
grant execute on function public.farm_org_modules() to authenticated;

-- ============================================================
-- 4. handle_new_farm_user — grava o field_mode do cadastro
-- ============================================================
create or replace function public.handle_new_farm_user()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
declare
  invite_code text;
  invite_rec public.farm_org_invites%rowtype;
  new_org_id uuid;
  trial_end timestamptz;
  signup_farm_name text;
  signup_full_name text;
  general_cc_id uuid;
  signup_field_mode text;
  cc_id uuid;
  seats_used integer;
  seats_max integer;
begin
  invite_code := nullif(trim(new.raw_user_meta_data ->> 'farm_invite_code'), '');

  -- (A) Fluxo de convite
  if invite_code is not null then
    select * into invite_rec
      from public.farm_org_invites
      where code = invite_code and used = false and expires_at > now()
      limit 1;

    if not found then
      raise exception 'Codigo de convite invalido ou expirado.';
    end if;

    -- Teto de assentos, conferido de novo AQUI: entre criar o convite e usá-lo,
    -- o limite pode ter mudado (ou outros convites pendentes podem ter entrado).
    select count(*) into seats_used
      from public.users_meta where organization_id = invite_rec.organization_id;
    select coalesce(seats_limit, 1) into seats_max
      from public.organizations where id = invite_rec.organization_id;
    if seats_used >= seats_max then
      raise exception 'Limite de usuarios da organizacao atingido. Fale com o gestor.';
    end if;

    insert into public.users_meta (user_id, organization_id, role, full_name, phone)
    values (
      new.id,
      invite_rec.organization_id,
      invite_rec.role,
      coalesce(new.raw_user_meta_data ->> 'full_name', invite_rec.invited_name, ''),
      new.raw_user_meta_data ->> 'phone'
    );

    if array_length(invite_rec.cost_center_ids, 1) > 0 then
      foreach cc_id in array invite_rec.cost_center_ids loop
        insert into public.farm_user_cost_centers (user_id, cost_center_id, organization_id)
          values (new.id, cc_id, invite_rec.organization_id)
          on conflict do nothing;
      end loop;
    end if;

    update public.farm_org_invites
      set used = true, used_by = new.id, used_at = now()
      where id = invite_rec.id;

    -- Quem volta pra uma org de onde já saiu deixa de ser "ex-membro".
    delete from public.farm_org_former_members
      where organization_id = invite_rec.organization_id and user_id = new.id;

    return new;
  end if;

  -- (B) Fluxo de signup normal (owner novo)
  if (new.raw_user_meta_data ->> 'farm_signup') is null then
    return new;
  end if;

  signup_farm_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'farm_name'), ''), 'Minha Fazenda');
  signup_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  trial_end := now() + interval '14 days';
  -- Modo de uso do Field: só os dois valores conhecidos; qualquer outra coisa
  -- vira NULL (= fazenda), em vez de derrubar o cadastro no check da coluna.
  signup_field_mode := case
    when new.raw_user_meta_data ->> 'field_mode' in ('fazenda', 'consultor')
      then new.raw_user_meta_data ->> 'field_mode'
    else null
  end;

  insert into public.organizations (name, type, trial_started_at, trial_ends_at)
  values (signup_farm_name, 'farm', now(), trial_end)
  returning id into new_org_id;

  insert into public.users_meta (user_id, organization_id, role, full_name, phone, cpf, field_mode)
  values (
    new.id,
    new_org_id,
    'owner',
    signup_full_name,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'cpf',
    signup_field_mode
  );

  insert into public.farms (organization_id, name)
  values (new_org_id, signup_farm_name);

  insert into public.farm_cost_centers (organization_id, slug, name, is_default, color)
    values (new_org_id, 'geral', 'Geral', true, '#64748b')
    returning id into general_cc_id;

  return new;
end;

-- create or replace preserva os grants, mas o revoke é repetido por garantia
-- (mesma regra de 20260819140000_gerentia_rpc_hardening.sql).
revoke execute on function public.handle_new_farm_user()
  from public, anon, authenticated;

-- ============================================================
-- 5. RLS de farms
-- ============================================================
-- Leitura: a org inteira (fazenda é dado da organização, como o centro de custo).
-- Escrita: quem pode escrever (todos menos o convidado). Quem cria fazenda e se o
-- membro só edita a própria fica para a fase 1, com o cadastro de fazendas.
drop policy if exists "farms scoped to org" on public.farms;

create policy "farms read by org" on public.farms
  for select using (organization_id = public.farm_current_org_id());

create policy "farms insert by writers" on public.farms
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
  );

create policy "farms update by writers" on public.farms
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
  );

create policy "farms delete by writers" on public.farms
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
  );

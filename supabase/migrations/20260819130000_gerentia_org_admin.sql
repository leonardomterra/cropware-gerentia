-- gerentia.app — Etapa 4: gestão de organizações pelo Master.
-- Ver docs/ORGANIZACOES-E-PERFIS.md §6.
--
-- 1) farm_org_former_members: quem SAIU da organização. Decisão de produto: os
--    lançamentos ficam com a empresa quando a pessoa é desvinculada, então a
--    lista do gestor precisa continuar sabendo o nome de quem lançou — senão o
--    histórico vira "Lançado por (?)".
-- 2) handle_new_farm_user: confere o teto de assentos TAMBÉM no consumo do
--    convite. Antes só a criação do convite conferia; se o Master reduzisse o
--    seats_limit depois, um convite pendente ainda entrava.

-- ============================================================
-- 1. farm_org_former_members
-- ============================================================
create table public.farm_org_former_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  removed_at timestamptz not null default now(),
  removed_by uuid references auth.users(id),
  primary key (organization_id, user_id)
);

alter table public.farm_org_former_members enable row level security;

-- Mesma regra do "Lançado por": quem enxerga a organização inteira precisa do
-- nome pra ler o histórico. Escrita é só service role (endpoint do Master).
create policy "former members read by org readers" on public.farm_org_former_members
  for select using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_read_all()
  );

grant select on public.farm_org_former_members to authenticated;

-- ============================================================
-- 2. handle_new_farm_user — teto de assentos no consumo do convite
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

  insert into public.organizations (name, type, trial_started_at, trial_ends_at)
  values (signup_farm_name, 'farm', now(), trial_end)
  returning id into new_org_id;

  insert into public.users_meta (user_id, organization_id, role, full_name, phone, cpf)
  values (
    new.id,
    new_org_id,
    'owner',
    signup_full_name,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'cpf'
  );

  insert into public.farms (organization_id, name)
  values (new_org_id, signup_farm_name);

  insert into public.farm_cost_centers (organization_id, slug, name, is_default, color)
    values (new_org_id, 'geral', 'Geral', true, '#64748b')
    returning id into general_cc_id;

  return new;
end;
$$;

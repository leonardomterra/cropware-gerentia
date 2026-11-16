-- Unificação Flag Field → gerentia, fase 2: a safra.
-- Ver docs/UNIFICACAO-FIELD.md e o plano da fase 2.
--
-- 1) farm_seasons    — safras cadastradas pela organização (nome, início, fim).
-- 2) farm_products   — catálogo de insumos. SEM preço (decisão de 16/11/2026: o
--                      custo é digitado em R$/ha na atividade, como no Flag Field).
-- 3) farm_plantings  — plantio = talhão × safra × cultura.
-- 4) farm_activities — atividades de campo, com o custo agronômico.
-- 5) Coerência: plantio é do talhão, talhão é da fazenda, tudo da mesma org
--    (triggers; a atividade deduz talhão/fazenda do plantio).
-- 6) RLS: safras e catálogo a org inteira LÊ (são referência); plantios e
--    atividades "igual ao financeiro". Escrita exige o módulo Field.
-- 7) farm_restaurar_backup: as 4 tabelas na lista branca. Corpo copiado de
--    20261118120000_field_cadastros.sql; só a lista muda.

-- ============================================================
-- 1. farm_seasons
-- ============================================================
create table public.farm_seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  starts_on date not null,
  ends_on date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create unique index farm_seasons_org_name_uidx on public.farm_seasons (organization_id, lower(name));

create index farm_seasons_org_creator_idx on public.farm_seasons (organization_id, created_by);
create trigger farm_seasons_set_updated_at
  before update on public.farm_seasons
  for each row execute function public.farm_set_updated_at();
alter table public.farm_seasons enable row level security;
grant select, insert, update, delete on public.farm_seasons to authenticated;

-- ============================================================
-- 2. farm_products
-- ============================================================
create table public.farm_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'outros' check (category in (
    'sementes','defensivos','fertilizantes','biologicos','nutricao',
    'adjuvantes','inoculantes','fisiologia','especialidades','outros')),
  manufacturer text,
  supplier text,
  active_ingredient text,
  -- Só sementes:
  crop text,
  genetics text,
  maturation_group numeric(4,1),
  cycle_days integer check (cycle_days is null or cycle_days > 0),
  cycle_type text check (cycle_type is null or cycle_type in ('super_precoce','precoce','medio','tardio')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index farm_products_org_name_uidx on public.farm_products (organization_id, lower(name));

create index farm_products_org_creator_idx on public.farm_products (organization_id, created_by);
create trigger farm_products_set_updated_at
  before update on public.farm_products
  for each row execute function public.farm_set_updated_at();
alter table public.farm_products enable row level security;
grant select, insert, update, delete on public.farm_products to authenticated;

-- ============================================================
-- 3. farm_plantings
-- ============================================================
create table public.farm_plantings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  plot_id uuid not null references public.farm_plots(id) on delete cascade,
  season_id uuid references public.farm_seasons(id) on delete set null,
  crop text not null check (length(trim(crop)) > 0),
  variety text,
  purpose text not null default 'grain_production' check (purpose in (
    'grain_production','seed_field','demo_field','gd_commercial','third_party','other')),
  planting_date date,
  expected_harvest_date date,
  lifecycle text not null default 'active' check (lifecycle in ('planned','active','completed')),
  completed_at timestamptz,
  population numeric(12,2) check (population is null or population > 0),
  population_unit text check (population_unit is null or population_unit in ('plantas_ha','kg_ha')),
  area_type text not null default 'total' check (area_type in ('total','partial')),
  partial_area_ha numeric(12,2) check (partial_area_ha is null or partial_area_ha > 0),
  seed_category_planted text,
  seed_category_harvested text,
  seed_homologation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (area_type = 'total' or partial_area_ha is not null)
);
create index farm_plantings_plot_idx on public.farm_plantings (plot_id);
create index farm_plantings_season_idx on public.farm_plantings (season_id);

create index farm_plantings_org_creator_idx on public.farm_plantings (organization_id, created_by);
create trigger farm_plantings_set_updated_at
  before update on public.farm_plantings
  for each row execute function public.farm_set_updated_at();
alter table public.farm_plantings enable row level security;
grant select, insert, update, delete on public.farm_plantings to authenticated;

-- ============================================================
-- 4. farm_activities
-- ============================================================
create table public.farm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  farm_id uuid not null references public.farms(id) on delete cascade,
  plot_id uuid references public.farm_plots(id) on delete cascade,
  planting_id uuid references public.farm_plantings(id) on delete set null,
  type text not null check (type in (
    'spraying','fertilization','liming','plastering','irrigation',
    'harvest','planting','observation','annotation','sampling',
    'rain','climate','visit')),
  date date not null,
  status text not null default 'realizada' check (status in ('planejada','realizada')),
  responsible text,
  description text,
  area_type text not null default 'total' check (area_type in ('total','partial')),
  treated_area_ha numeric(12,2) check (treated_area_ha is null or treated_area_ha > 0),
  products jsonb not null default '[]'::jsonb check (jsonb_typeof(products) = 'array'),
  -- Custo agronômico TOTAL em R$, calculado na tela (src/modules/field/dominio/custo.ts)
  -- e gravado para os relatórios somarem sem refazer a conta.
  cost_total numeric(14,2) check (cost_total is null or cost_total >= 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farm_activities_farm_date_idx on public.farm_activities (farm_id, date);
create index farm_activities_plot_idx on public.farm_activities (plot_id);
create index farm_activities_planting_idx on public.farm_activities (planting_id);

create index farm_activities_org_creator_idx on public.farm_activities (organization_id, created_by);
create trigger farm_activities_set_updated_at
  before update on public.farm_activities
  for each row execute function public.farm_set_updated_at();
alter table public.farm_activities enable row level security;
grant select, insert, update, delete on public.farm_activities to authenticated;

-- ============================================================
-- 5. Coerência (talhão/plantio/fazenda da mesma org e encaixados)
-- ============================================================
create or replace function public.farm_plantings_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $f$
begin
  if not exists (
    select 1 from public.farm_plots p
     where p.id = new.plot_id and p.organization_id = new.organization_id
  ) then
    raise exception 'O talhao do plantio nao pertence a organizacao.';
  end if;
  if new.season_id is not null and not exists (
    select 1 from public.farm_seasons s
     where s.id = new.season_id and s.organization_id = new.organization_id
  ) then
    raise exception 'A safra do plantio nao pertence a organizacao.';
  end if;
  return new;
end;
$f$;
revoke execute on function public.farm_plantings_check() from public, anon, authenticated;
create trigger farm_plantings_check
  before insert or update of plot_id, season_id, organization_id on public.farm_plantings
  for each row execute function public.farm_plantings_check();

-- A atividade com plantio herda talhão e fazenda dele; com talhão, herda a
-- fazenda. Assim nunca fica "plantio do talhão A, talhão B".
create or replace function public.farm_activities_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $f$
declare
  v_plot uuid;
  v_farm uuid;
begin
  if new.planting_id is not null then
    select pl.plot_id into v_plot from public.farm_plantings pl
     where pl.id = new.planting_id and pl.organization_id = new.organization_id;
    if v_plot is null then
      raise exception 'O plantio da atividade nao pertence a organizacao.';
    end if;
    new.plot_id := v_plot;
  end if;
  if new.plot_id is not null then
    select p.farm_id into v_farm from public.farm_plots p
     where p.id = new.plot_id and p.organization_id = new.organization_id;
    if v_farm is null then
      raise exception 'O talhao da atividade nao pertence a organizacao.';
    end if;
    new.farm_id := v_farm;
  end if;
  if not exists (
    select 1 from public.farms f
     where f.id = new.farm_id and f.organization_id = new.organization_id
  ) then
    raise exception 'A fazenda da atividade nao pertence a organizacao.';
  end if;
  return new;
end;
$f$;
revoke execute on function public.farm_activities_check() from public, anon, authenticated;
create trigger farm_activities_check
  before insert or update of farm_id, plot_id, planting_id, organization_id on public.farm_activities
  for each row execute function public.farm_activities_check();

-- ============================================================
-- 6. RLS
-- ============================================================

-- Referência da organização: todo mundo da org lê (o Usuário precisa da safra
-- e do catálogo para lançar plantio/atividade, mesmo os cadastrados por outro).
create policy "farm_seasons read by org" on public.farm_seasons
  for select using (organization_id = public.farm_current_org_id());

create policy "farm_seasons insert own" on public.farm_seasons
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_seasons update own" on public.farm_seasons
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_seasons delete own" on public.farm_seasons
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );


-- Referência da organização: todo mundo da org lê (o Usuário precisa da safra
-- e do catálogo para lançar plantio/atividade, mesmo os cadastrados por outro).
create policy "farm_products read by org" on public.farm_products
  for select using (organization_id = public.farm_current_org_id());

create policy "farm_products insert own" on public.farm_products
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_products update own" on public.farm_products
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_products delete own" on public.farm_products
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );


create policy "farm_plantings read" on public.farm_plantings
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );

create policy "farm_plantings insert own" on public.farm_plantings
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_plantings update own" on public.farm_plantings
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_plantings delete own" on public.farm_plantings
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );


create policy "farm_activities read" on public.farm_activities
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );

create policy "farm_activities insert own" on public.farm_activities
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_activities update own" on public.farm_activities
  for update using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
  ) with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_activities delete own" on public.farm_activities
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

-- ============================================================
-- 7. farm_restaurar_backup — tabelas novas na lista branca
-- ============================================================
create or replace function public.farm_restaurar_backup(
  p_ordem text[],
  p_tabelas jsonb,
  p_somente_inserir text[] default '{}'::text[],
  p_aplicar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tabela   text;
  v_reg      regclass;
  v_pk       text[];
  v_cols     text[];       -- interseção: colunas do pacote ∩ colunas de hoje
  v_ignorar  text[];       -- colunas de hoje que o pacote não traz
  v_linhas   jsonb;
  v_lista    text;
  v_cond     text;
  v_set      text;
  v_sql      text;
  v_conta    jsonb;
  v_saida    jsonb := '{}'::jsonb;
  v_total    jsonb := jsonb_build_object('repostas', 0, 'sobrescritas', 0, 'intactas', 0);
begin
  foreach v_tabela in array p_ordem loop
    v_linhas := coalesce(p_tabelas -> v_tabela, '[]'::jsonb);
    if jsonb_array_length(v_linhas) = 0 then
      continue;
    end if;

    -- Só tabelas do pacote. Blindagem contra p_ordem inventado: a função é
    -- SECURITY DEFINER e monta SQL dinâmico — sem esta lista, um nome de tabela
    -- arbitrário viraria escrita arbitrária no banco.
    if v_tabela <> all (array[
      'organizations','users_meta','farm_seasons','farm_products',
      'farm_producers','farms','farm_plots','farm_plantings','farm_activities',
      'farm_cost_centers',
      'farm_category_groups','farm_categories','farm_recurring_receipts',
      'farm_receipts','farm_receipt_items','farm_tasks','farm_user_cost_centers',
      'farm_whatsapp_links','farm_notifications','farm_org_invites',
      'farm_org_former_members','farm_category_hidden'
    ]) then
      raise exception 'Tabela % nao faz parte do pacote de backup.', v_tabela;
    end if;

    v_reg := ('public.' || quote_ident(v_tabela))::regclass;

    -- CHAVE PRIMÁRIA lida do catálogo, não escrita à mão: três destas tabelas
    -- têm chave composta, e uma lista fixa aqui envelheceria em silêncio.
    select array_agg(a.attname order by k.ord) into v_pk
    from pg_constraint pk
    cross join lateral unnest(pk.conkey) with ordinality as k(att, ord)
    join pg_attribute a on a.attrelid = pk.conrelid and a.attnum = k.att
    where pk.conrelid = v_reg and pk.contype = 'p';

    if v_pk is null then
      raise exception 'Tabela % nao tem chave primaria.', v_tabela;
    end if;

    -- INTERSEÇÃO das colunas. O pacote pode ser de antes de uma migração:
    -- coluna que sumiu é ignorada, e coluna criada depois NÃO é mexida (em vez
    -- de virar NULL, que apagaria dado atual num pacote antigo).
    select array_agg(a.attname order by a.attnum) into v_cols
    from pg_attribute a
    where a.attrelid = v_reg and a.attnum > 0 and not a.attisdropped
      and jsonb_exists(v_linhas -> 0, a.attname);

    select array_agg(a.attname) into v_ignorar
    from pg_attribute a
    where a.attrelid = v_reg and a.attnum > 0 and not a.attisdropped
      and not jsonb_exists(v_linhas -> 0, a.attname);

    if v_pk <@ v_cols is not true then
      raise exception 'Pacote de % nao traz a chave primaria (%).', v_tabela, v_pk;
    end if;

    v_lista := (select string_agg(quote_ident(c), ', ') from unnest(v_cols) c);
    -- `(n.r).col` e nao `n.r.col`: `r` e um valor COMPOSTO, e sem os
    -- parenteses o Postgres le os tres niveis como schema.tabela.coluna.
    v_cond  := (select string_agg(format('t.%I = (n.r).%I', c, c), ' and ') from unnest(v_pk) c);
    v_set   := (select string_agg(format('%I = excluded.%I', c, c), ', ')
                from unnest(v_cols) c where c <> all (v_pk));

    -- ---------------------------------------------------------------- contar
    --
    -- Os dois lados passam por `jsonb_populate_recordset` + `to_jsonb` do MESMO
    -- tipo de linha antes de comparar. Comparar o JSON cru do pacote com
    -- to_jsonb da tabela daria falso "sobrescrita" toda vez que a serialização
    -- de data ou numérico diferisse por um detalhe de formato.
    v_sql := format($f$
      with n as (
        select r from jsonb_populate_recordset(null::%1$s, $1) r
      ), cmp as (
        select
          (select to_jsonb(t.*) from %1$s t where %2$s) as atual,
          to_jsonb(n.r) as novo
        from n
      )
      select jsonb_build_object(
        'repostas',     count(*) filter (where atual is null),
        'sobrescritas', count(*) filter (where atual is not null
                                           and not (atual @> (novo - $2::text[]))),
        'intactas',     count(*) filter (where atual is not null
                                           and atual @> (novo - $2::text[]))
      )
      from cmp
    $f$, v_reg::text, v_cond);

    execute v_sql into v_conta using v_linhas, coalesce(v_ignorar, '{}'::text[]);

    -- Em somente-inserir o que existe não é tocado: sai da conta de
    -- sobrescritas e entra na de intactas, senão a pré-visualização prometeria
    -- uma mudança que não vai acontecer.
    if v_tabela = any (p_somente_inserir) then
      v_conta := jsonb_build_object(
        'repostas',     v_conta -> 'repostas',
        'sobrescritas', to_jsonb(0),
        'intactas',     to_jsonb(
          (v_conta ->> 'intactas')::int + (v_conta ->> 'sobrescritas')::int)
      );
    end if;

    v_saida := v_saida || jsonb_build_object(v_tabela, v_conta);
    v_total := jsonb_build_object(
      'repostas',     to_jsonb((v_total ->> 'repostas')::int     + (v_conta ->> 'repostas')::int),
      'sobrescritas', to_jsonb((v_total ->> 'sobrescritas')::int + (v_conta ->> 'sobrescritas')::int),
      'intactas',     to_jsonb((v_total ->> 'intactas')::int     + (v_conta ->> 'intactas')::int)
    );

    -- ---------------------------------------------------------------- aplicar
    if p_aplicar then
      if v_tabela = any (p_somente_inserir) or v_set is null then
        v_sql := format(
          'insert into %1$s (%2$s) select %2$s from jsonb_populate_recordset(null::%1$s, $1) on conflict (%3$s) do nothing',
          v_reg::text, v_lista,
          (select string_agg(quote_ident(c), ', ') from unnest(v_pk) c));
      else
        v_sql := format(
          'insert into %1$s (%2$s) select %2$s from jsonb_populate_recordset(null::%1$s, $1) on conflict (%3$s) do update set %4$s',
          v_reg::text, v_lista,
          (select string_agg(quote_ident(c), ', ') from unnest(v_pk) c), v_set);
      end if;
      execute v_sql using v_linhas;
    end if;
  end loop;

  return jsonb_build_object(
    'aplicado', p_aplicar,
    'total', v_total,
    'por_tabela', v_saida
  );
end;
$$;

revoke execute on function public.farm_restaurar_backup(text[], jsonb, text[], boolean)
  from public, anon, authenticated;

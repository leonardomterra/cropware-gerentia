-- Unificação Flag Field → gerentia, fase 4: ensaios (desenvolvimento de mercado).
-- Ver docs/UNIFICACAO-FIELD.md e o plano da fase 4.
--
-- No Flag Field o ensaio era uma linha de `plantings` com um `trial_data jsonb`
-- gigante, salvo inteiro de uma vez. Aqui cada parte tem tabela e salva na hora:
--   farm_trials             o ensaio (fazenda obrigatória; talhão, plantio e safra opcionais)
--   farm_trial_products     os produtos comparados (principal | concorrente) + custo do ROI
--   farm_trial_steps        as etapas de avaliação (características valem p/ todos os produtos)
--   farm_trial_evaluations  uma avaliação = um produto numa etapa; step nulo = avulsa
--                           (é o que o bot do WhatsApp grava — no Flag Field elas sumiam da tela)
--   farm_trial_harvests     a colheita, uma por produto
-- RLS "igual ao financeiro"; escrita exige o módulo Field. Restauração: corpo
-- copiado de 20261119120000_field_safra.sql, só a lista muda.

create table public.farm_trials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  farm_id uuid not null references public.farms(id) on delete cascade,
  plot_id uuid references public.farm_plots(id) on delete set null,
  planting_id uuid references public.farm_plantings(id) on delete set null,
  season_id uuid references public.farm_seasons(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 40),
  crop text not null check (length(trim(crop)) > 0),
  trial_type text not null default 'sementes' check (trial_type in (
    'sementes','nutricao','biologicos','defensivos','fertilizantes','especialidades','outros')),
  standard_variety text,
  implantation_date date,
  lifecycle text not null default 'active' check (lifecycle in ('active','completed')),
  completed_at timestamptz,
  -- ROI: preço da saca (R$) e o produto de referência (FK criada mais abaixo).
  sack_price numeric(12,2) check (sack_price is null or sack_price > 0),
  roi_reference_product_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farm_trials_farm_idx on public.farm_trials (farm_id);
create index farm_trials_org_creator_idx on public.farm_trials (organization_id, created_by);
create trigger farm_trials_set_updated_at
  before update on public.farm_trials
  for each row execute function public.farm_set_updated_at();
alter table public.farm_trials enable row level security;
grant select, insert, update, delete on public.farm_trials to authenticated;

create table public.farm_trial_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  trial_id uuid not null references public.farm_trials(id) on delete cascade,
  catalog_product_id uuid references public.farm_products(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  manufacturer text,
  role text not null check (role in ('principal','concorrente')),
  dose_value numeric(12,3) check (dose_value is null or dose_value > 0),
  dose_unit text,
  population numeric(14,2) check (population is null or population > 0),
  -- Custo do produto em R$/ha — a entrada do ROI (uma por produto).
  cost_ha numeric(12,2) check (cost_ha is null or cost_ha >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farm_trial_products_trial_idx on public.farm_trial_products (trial_id);
create index farm_trial_products_org_creator_idx on public.farm_trial_products (organization_id, created_by);
create trigger farm_trial_products_set_updated_at
  before update on public.farm_trial_products
  for each row execute function public.farm_set_updated_at();
alter table public.farm_trial_products enable row level security;
grant select, insert, update, delete on public.farm_trial_products to authenticated;

alter table public.farm_trials
  add constraint farm_trials_roi_reference_fk
  foreign key (roi_reference_product_id) references public.farm_trial_products(id) on delete set null
  -- Adiada para o fim da transação: ensaio e produto apontam um para o outro, e a
  -- restauração de backup insere o ensaio ANTES dos produtos.
  deferrable initially deferred;

create table public.farm_trial_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  trial_id uuid not null references public.farm_trials(id) on delete cascade,
  evaluation_type text not null,
  stage text,
  characteristics jsonb not null default '[]'::jsonb check (jsonb_typeof(characteristics) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farm_trial_steps_trial_idx on public.farm_trial_steps (trial_id);
create index farm_trial_steps_org_creator_idx on public.farm_trial_steps (organization_id, created_by);
create trigger farm_trial_steps_set_updated_at
  before update on public.farm_trial_steps
  for each row execute function public.farm_set_updated_at();
alter table public.farm_trial_steps enable row level security;
grant select, insert, update, delete on public.farm_trial_steps to authenticated;

create table public.farm_trial_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  trial_id uuid not null references public.farm_trials(id) on delete cascade,
  step_id uuid references public.farm_trial_steps(id) on delete cascade,
  product_id uuid not null references public.farm_trial_products(id) on delete cascade,
  date date not null,
  "values" jsonb not null default '{}'::jsonb check (jsonb_typeof("values") = 'object'),
  -- Só nas avulsas (sem etapa): a definição das características, copiada.
  characteristics jsonb check (characteristics is null or jsonb_typeof(characteristics) = 'array'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farm_trial_evaluations_trial_idx on public.farm_trial_evaluations (trial_id);
create unique index farm_trial_evaluations_step_product_uidx
  on public.farm_trial_evaluations (step_id, product_id) where step_id is not null;
create index farm_trial_evaluations_org_creator_idx on public.farm_trial_evaluations (organization_id, created_by);
create trigger farm_trial_evaluations_set_updated_at
  before update on public.farm_trial_evaluations
  for each row execute function public.farm_set_updated_at();
alter table public.farm_trial_evaluations enable row level security;
grant select, insert, update, delete on public.farm_trial_evaluations to authenticated;

create table public.farm_trial_harvests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  trial_id uuid not null references public.farm_trials(id) on delete cascade,
  product_id uuid not null unique references public.farm_trial_products(id) on delete cascade,
  harvest_date date,
  input_mode text not null default 'manual' check (input_mode in ('manual','calculada')),
  productivity numeric(10,2) not null check (productivity > 0),
  net_weight_kg numeric(12,2),
  harvested_area_ha numeric(10,4),
  moisture numeric(5,2) not null check (moisture >= 0 and moisture < 100),
  target_moisture numeric(5,2) check (target_moisture is null or (target_moisture >= 10 and target_moisture <= 25)),
  corrected_productivity numeric(10,2),
  impurity numeric(5,2),
  pmg numeric(8,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farm_trial_harvests_trial_idx on public.farm_trial_harvests (trial_id);
create index farm_trial_harvests_org_creator_idx on public.farm_trial_harvests (organization_id, created_by);
create trigger farm_trial_harvests_set_updated_at
  before update on public.farm_trial_harvests
  for each row execute function public.farm_set_updated_at();
alter table public.farm_trial_harvests enable row level security;
grant select, insert, update, delete on public.farm_trial_harvests to authenticated;

-- ============================================================
-- Coerência
-- ============================================================
-- Ensaio: plantio → talhão → fazenda, tudo da mesma org.
create or replace function public.farm_trials_check()
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
    if v_plot is null then raise exception 'O plantio do ensaio nao pertence a organizacao.'; end if;
    new.plot_id := v_plot;
  end if;
  if new.plot_id is not null then
    select p.farm_id into v_farm from public.farm_plots p
     where p.id = new.plot_id and p.organization_id = new.organization_id;
    if v_farm is null then raise exception 'O talhao do ensaio nao pertence a organizacao.'; end if;
    new.farm_id := v_farm;
  end if;
  if not exists (select 1 from public.farms f where f.id = new.farm_id and f.organization_id = new.organization_id) then
    raise exception 'A fazenda do ensaio nao pertence a organizacao.';
  end if;
  if new.season_id is not null and not exists (
    select 1 from public.farm_seasons s where s.id = new.season_id and s.organization_id = new.organization_id
  ) then
    raise exception 'A safra do ensaio nao pertence a organizacao.';
  end if;
  return new;
end;
$f$;
revoke execute on function public.farm_trials_check() from public, anon, authenticated;
create trigger farm_trials_check
  before insert or update of farm_id, plot_id, planting_id, season_id, organization_id
  on public.farm_trials
  for each row execute function public.farm_trials_check();

-- Filhos: o ensaio é da mesma org; produto e etapa são do MESMO ensaio.
create or replace function public.farm_trial_filho_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $f$
begin
  if not exists (
    select 1 from public.farm_trials t where t.id = new.trial_id and t.organization_id = new.organization_id
  ) then
    raise exception 'O ensaio nao pertence a organizacao.';
  end if;
  if tg_table_name in ('farm_trial_evaluations', 'farm_trial_harvests') and not exists (
    select 1 from public.farm_trial_products p where p.id = new.product_id and p.trial_id = new.trial_id
  ) then
    raise exception 'O produto nao e deste ensaio.';
  end if;
  if tg_table_name = 'farm_trial_evaluations' and new.step_id is not null and not exists (
    select 1 from public.farm_trial_steps s where s.id = new.step_id and s.trial_id = new.trial_id
  ) then
    raise exception 'A etapa nao e deste ensaio.';
  end if;
  return new;
end;
$f$;
revoke execute on function public.farm_trial_filho_check() from public, anon, authenticated;
create trigger farm_trial_products_check before insert or update on public.farm_trial_products
  for each row execute function public.farm_trial_filho_check();
create trigger farm_trial_steps_check before insert or update on public.farm_trial_steps
  for each row execute function public.farm_trial_filho_check();
create trigger farm_trial_evaluations_check before insert or update on public.farm_trial_evaluations
  for each row execute function public.farm_trial_filho_check();
create trigger farm_trial_harvests_check before insert or update on public.farm_trial_harvests
  for each row execute function public.farm_trial_filho_check();

-- ============================================================
-- RLS
-- ============================================================

create policy "farm_trials read" on public.farm_trials
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );
create policy "farm_trials insert own" on public.farm_trials
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );
create policy "farm_trials update own" on public.farm_trials
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
create policy "farm_trials delete own" on public.farm_trials
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_trial_products read" on public.farm_trial_products
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );
create policy "farm_trial_products insert own" on public.farm_trial_products
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );
create policy "farm_trial_products update own" on public.farm_trial_products
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
create policy "farm_trial_products delete own" on public.farm_trial_products
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_trial_steps read" on public.farm_trial_steps
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );
create policy "farm_trial_steps insert own" on public.farm_trial_steps
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );
create policy "farm_trial_steps update own" on public.farm_trial_steps
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
create policy "farm_trial_steps delete own" on public.farm_trial_steps
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_trial_evaluations read" on public.farm_trial_evaluations
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );
create policy "farm_trial_evaluations insert own" on public.farm_trial_evaluations
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );
create policy "farm_trial_evaluations update own" on public.farm_trial_evaluations
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
create policy "farm_trial_evaluations delete own" on public.farm_trial_evaluations
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_trial_harvests read" on public.farm_trial_harvests
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );
create policy "farm_trial_harvests insert own" on public.farm_trial_harvests
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );
create policy "farm_trial_harvests update own" on public.farm_trial_harvests
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
create policy "farm_trial_harvests delete own" on public.farm_trial_harvests
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

-- ============================================================
-- farm_restaurar_backup — tabelas novas na lista branca
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
      'farm_trials','farm_trial_products','farm_trial_steps','farm_trial_evaluations',
      'farm_trial_harvests',
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

-- Unificação Flag Field → gerentia, fase 1: cadastros do Field.
-- Ver docs/UNIFICACAO-FIELD.md e o plano da fase 1.
--
-- 1) farm_producers  — produtores (só aparece no modo "consultor").
-- 2) farms           — a tabela já existia (org → fazendas) mas era de fachada;
--                      ganha produtor, autoria, IE e a sede (lat/lng).
-- 3) farm_plots      — talhões. Geometria em GeoJSON ([lng,lat]) num jsonb:
--                      Polygon (desenhado) ou Point (marcador); NULL = só área.
-- 4) farm_receipts.plot_id — o lançamento financeiro ligado ao talhão.
-- 5) RLS das três tabelas no padrão do farm_receipts: "igual ao financeiro"
--    (decisão de 16/11/2026) — o Usuário (member) vê e edita só o que criou;
--    gestores e convidado veem tudo da org. ESCRITA exige o módulo Field;
--    LEITURA não, para o nome da fazenda seguir aparecendo nos lançamentos de
--    quem deixou de assinar o Field.
-- 6) farm_restaurar_backup: as tabelas novas entram na lista branca. Corpo
--    copiado de 20260824160000_farm_restaurar_backup.sql (conferido igual ao de
--    produção em 16/11/2026); a única mudança é a lista.

-- ============================================================
-- 1. farm_producers
-- ============================================================
create table public.farm_producers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  document text,
  email text,
  phone text,
  partner text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index farm_producers_org_name_uidx
  on public.farm_producers (organization_id, lower(name));
create index farm_producers_org_creator_idx
  on public.farm_producers (organization_id, created_by);

create trigger farm_producers_set_updated_at
  before update on public.farm_producers
  for each row execute function public.farm_set_updated_at();

alter table public.farm_producers enable row level security;
grant select, insert, update, delete on public.farm_producers to authenticated;

-- ============================================================
-- 2. farms (amplia)
-- ============================================================
alter table public.farms
  add column if not exists producer_id uuid references public.farm_producers(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists state_registration text,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists updated_at timestamptz not null default now();

alter table public.farms alter column created_by set default auth.uid();

-- Autoria das fazendas que já existem (a do cadastro de cada org): o titular.
-- Org sem titular fica NULL — só gestores/convidado a enxergam, o que é o certo.
update public.farms f
   set created_by = (
     select um.user_id from public.users_meta um
      where um.organization_id = f.organization_id and um.role = 'owner'
      order by um.user_id limit 1)
 where f.created_by is null;

create unique index farms_org_producer_name_uidx
  on public.farms (organization_id, producer_id, lower(name)) nulls not distinct;
create index if not exists farms_producer_idx on public.farms (producer_id);
create index if not exists farms_org_creator_idx on public.farms (organization_id, created_by);

create trigger farms_set_updated_at
  before update on public.farms
  for each row execute function public.farm_set_updated_at();

-- ============================================================
-- 3. farm_plots (talhões)
-- ============================================================
create table public.farm_plots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  area_ha numeric(12,2) not null check (area_ha > 0),
  irrigation text not null default 'sequeiro' check (irrigation in ('sequeiro', 'irrigado')),
  geometry jsonb check (geometry is null or geometry ->> 'type' in ('Polygon', 'Point')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index farm_plots_farm_name_uidx on public.farm_plots (farm_id, lower(name));
create index farm_plots_org_creator_idx on public.farm_plots (organization_id, created_by);

create trigger farm_plots_set_updated_at
  before update on public.farm_plots
  for each row execute function public.farm_set_updated_at();

alter table public.farm_plots enable row level security;
grant select, insert, update, delete on public.farm_plots to authenticated;

-- O talhão é da mesma org da fazenda — conferido no banco, não só na tela.
create or replace function public.farm_plots_check_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $f$
begin
  if not exists (
    select 1 from public.farms f
     where f.id = new.farm_id and f.organization_id = new.organization_id
  ) then
    raise exception 'A fazenda do talhao nao pertence a organizacao.';
  end if;
  return new;
end;
$f$;
revoke execute on function public.farm_plots_check_org() from public, anon, authenticated;

create trigger farm_plots_check_org
  before insert or update of farm_id, organization_id on public.farm_plots
  for each row execute function public.farm_plots_check_org();

-- ============================================================
-- 4. farm_receipts.plot_id
-- ============================================================
alter table public.farm_receipts
  add column if not exists plot_id uuid references public.farm_plots(id) on delete set null;
create index if not exists farm_receipts_plot_idx on public.farm_receipts (plot_id);

-- ============================================================
-- 5. RLS
-- ============================================================

create policy "farm_producers read" on public.farm_producers
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );

create policy "farm_producers insert own" on public.farm_producers
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_producers update own" on public.farm_producers
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

create policy "farm_producers delete own" on public.farm_producers
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

-- farms: troca as policies da fase 0 (20261117120000) pelo padrão acima.
drop policy if exists "farms read by org" on public.farms;
drop policy if exists "farms insert by writers" on public.farms;
drop policy if exists "farms update by writers" on public.farms;
drop policy if exists "farms delete by writers" on public.farms;

create policy "farms read" on public.farms
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );

create policy "farms insert own" on public.farms
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farms update own" on public.farms
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

create policy "farms delete own" on public.farms
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );


create policy "farm_plots read" on public.farm_plots
  for select using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or created_by = (select auth.uid()))
  );

create policy "farm_plots insert own" on public.farm_plots
  for insert with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and created_by = (select auth.uid())
    and 'field' = any (public.farm_org_modules())
  );

create policy "farm_plots update own" on public.farm_plots
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

create policy "farm_plots delete own" on public.farm_plots
  for delete using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (created_by = (select auth.uid()) or public.farm_can_write_others())
    and 'field' = any (public.farm_org_modules())
  );

-- ============================================================
-- 6. farm_restaurar_backup — tabelas novas na lista branca
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
      'organizations','users_meta','farm_producers','farms','farm_plots','farm_cost_centers',
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

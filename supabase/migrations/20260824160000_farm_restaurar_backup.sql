-- Gerentia — motor de restauração. Etapa 2 de docs/BACKUP-E-RESTAURACAO.md.
--
-- POR QUE UMA FUNÇÃO NO BANCO e não código na edge: a restauração toca várias
-- tabelas em ordem de dependência. Feita por chamadas REST soltas, uma falha no
-- meio deixaria metade restaurada — o pior estado possível, porque parece que
-- deu certo. Uma função é UMA transação: ou entra tudo, ou não entra nada.
--
-- REGRA CENTRAL (§3 do doc): restaurar REPÕE, nunca APAGA. É upsert por chave
-- primária. Linha que existe hoje e não está no pacote fica onde está. Isso
-- torna a operação idempotente — rodar duas vezes não faz mal — e impossível de
-- piorar a situação: só empata ou melhora.
--
-- DOIS MODOS por tabela:
--   upsert          insere o que falta E sobrescreve o que difere
--   somente-inserir insere o que falta e NÃO toca no que existe
--
-- O segundo existe para o CONTEXTO de um pacote de usuário. O lançamento dele
-- aponta para um centro de custo; se o centro sumiu junto, sem repor não há
-- como inserir o lançamento. Mas o centro de custo é da organização, não dele —
-- se ainda existe e foi editado por outra pessoa, não é dele para sobrescrever.
--
-- p_aplicar = false faz a PRÉ-VISUALIZAÇÃO: conta o que aconteceria e não
-- escreve nada. Obrigatória antes de aplicar. Sem ela ninguém tem coragem de
-- apertar o botão, e quem apertar não vai saber o que fez.

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
      'organizations','users_meta','farms','farm_cost_centers',
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

-- Só a edge (service_role) chama. Nem authenticated nem anon: a função é
-- SECURITY DEFINER e escreve em qualquer organização — quem decide o recorte e
-- o direito de restaurar é o handler, com o pacote em mãos.
revoke execute on function public.farm_restaurar_backup(text[], jsonb, text[], boolean)
  from public, anon, authenticated;

comment on function public.farm_restaurar_backup(text[], jsonb, text[], boolean) is
  'Restaura um pacote de backup: upsert por PK, nunca apaga. p_aplicar=false pré-visualiza. Ver docs/BACKUP-E-RESTAURACAO.md.';

-- Gerentia — cadastro de cartões. Etapa 2 de docs/CARTOES-E-FATURAS.md.
--
-- POR QUE EXISTE: desde 25/08 a FATURA é o que soma e a compra no cartão é
-- informativa. Só que um cliente tem 3, 6, 10 cartões, e sem saber de qual
-- cartão é cada fatura não há como conferir se a do Mastercard de agosto já
-- entrou — nem como impedir que ela entre duas vezes.
--
-- O CARTÃO É DA PESSOA, dentro de uma organização. Na prática o "cartão
-- corporativo" vem no nome do colaborador, e cada um opera o seu. O gestor
-- CONSULTA todos e opera apenas o dele.
--
-- Essa regra não é nova: é exatamente o que `farm_can_read_all()` e
-- `farm_can_write_others()` já produzem para lançamentos. As policies abaixo
-- reusam as duas — se um dia o interruptor de `farm_can_write_others` virar
-- true, os cartões acompanham sem ninguém lembrar de mexer aqui.

create table if not exists public.farm_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  -- Dono. SET NULL e não CASCADE, de propósito: apagar a pessoa não pode levar
  -- o cartão junto e deixar as faturas dela órfãs. É a mesma lição do
  -- 20260824170000, onde um CASCADE em `created_by_user_id` apagaria o plano de
  -- contas inteiro do cliente. Aqui `user_id` é ATRIBUIÇÃO, não posse — o
  -- cartão pertence à organização, como os lançamentos.
  user_id uuid references auth.users(id) on delete set null,

  -- Como a pessoa chama o cartão. É o que aparece nas listas e no WhatsApp.
  nome text not null,

  -- Sem check constraint: a lista cresce (bandeiras regionais, private label) e
  -- cada acréscimo exigiria migração só para liberar um valor. Mesmo raciocínio
  -- de `users_meta.activity_area`. Quem restringe é o <select> da tela.
  bandeira text,
  emissor text,

  -- Os 4 últimos dígitos, que é como a fatura se identifica. Guardados como
  -- TEXTO: zero à esquerda é significativo ("0042" ≠ 42).
  ultimos_digitos text check (
    ultimos_digitos is null or ultimos_digitos ~ '^[0-9]{4}$'
  ),

  -- DUAS datas, não uma. Fechamento e vencimento são coisas diferentes, e sem
  -- separá-las "a fatura de agosto" fica ambíguo: a que fechou ou a que vence?
  -- Só o dia; o mês se deriva da competência da fatura.
  dia_fechamento smallint check (dia_fechamento between 1 and 31),
  dia_vencimento smallint check (dia_vencimento between 1 and 31),

  limite numeric(12, 2),

  -- Cartão cancelado não some: as faturas antigas dele continuam apontando
  -- para cá. Sai dos seletores e fica no histórico.
  ativo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists farm_cards_por_org
  on public.farm_cards (organization_id, ativo);
create index if not exists farm_cards_por_dono
  on public.farm_cards (user_id);

-- Dois cartões do mesmo emissor com os mesmos 4 dígitos, na mesma organização,
-- são o mesmo cartão cadastrado duas vezes. É esta dupla que a etapa 4 vai usar
-- para reconhecer de qual cartão é a fatura que chegou por foto.
create unique index if not exists farm_cards_sem_duplicata
  on public.farm_cards (organization_id, lower(coalesce(emissor, '')), ultimos_digitos)
  where ultimos_digitos is not null;

-- ============================================================
-- Vínculo do lançamento com o cartão
-- ============================================================
--
-- Serve para os dois lados da regra nova: a COMPRA informativa diz em que
-- cartão ela vai cair, e a FATURA diz de que cartão ela é. Sem isso não há como
-- conciliar uma coisa com a outra.
--
-- SET NULL: apagar um cartão não pode apagar lançamento. O histórico fica sem o
-- vínculo, que é bem menos grave do que ficar sem o gasto.

alter table public.farm_receipts
  add column if not exists card_id uuid
    references public.farm_cards(id) on delete set null;

create index if not exists farm_receipts_por_cartao
  on public.farm_receipts (card_id, transaction_date desc)
  where card_id is not null;

-- Competência da fatura ("2026-08"), para barrar a mesma fatura entrando duas
-- vezes por caminhos diferentes — foto no WhatsApp e cadastro à mão na aba
-- Cartões. Guardada como DATA do primeiro dia do mês, e não texto: assim
-- ordena, compara e aceita intervalo sem conversão.
alter table public.farm_receipts
  add column if not exists competencia date;

create unique index if not exists farm_receipts_fatura_unica
  on public.farm_receipts (card_id, competencia)
  where doc_type = 'fatura' and card_id is not null and competencia is not null;

-- ============================================================
-- RLS
-- ============================================================

alter table public.farm_cards enable row level security;

drop policy if exists "cards select" on public.farm_cards;
drop policy if exists "cards insert" on public.farm_cards;
drop policy if exists "cards update" on public.farm_cards;
drop policy if exists "cards delete" on public.farm_cards;

-- LER: o próprio dono sempre; gestor e convidado, a organização inteira.
create policy "cards select" on public.farm_cards
  for select to authenticated
  using (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_read_all() or user_id = auth.uid())
  );

-- ESCREVER: só o dono do cartão — `farm_can_write_others()` é false hoje.
-- Convidado não escreve em lugar nenhum, e `farm_can_write()` já o exclui.
create policy "cards insert" on public.farm_cards
  for insert to authenticated
  with check (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (public.farm_can_write_others() or user_id = auth.uid())
  );

create policy "cards update" on public.farm_cards
  for update to authenticated
  using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (public.farm_can_write_others() or user_id = auth.uid())
  )
  with check (
    organization_id = public.farm_current_org_id()
    and (public.farm_can_write_others() or user_id = auth.uid())
  );

create policy "cards delete" on public.farm_cards
  for delete to authenticated
  using (
    organization_id = public.farm_current_org_id()
    and public.farm_can_write()
    and (public.farm_can_write_others() or user_id = auth.uid())
  );

comment on table public.farm_cards is
  'Cartões de crédito, um por pessoa dentro da organização. Dono opera; gestor consulta. Ver docs/CARTOES-E-FATURAS.md.';
comment on column public.farm_cards.user_id is
  'Atribuição, não posse: o cartão é da organização. SET NULL para apagar a pessoa não levar o cartão e orfanar as faturas.';
comment on column public.farm_receipts.competencia is
  'Mês de referência da fatura (dia 1). Com card_id forma a chave que impede a mesma fatura de entrar duas vezes.';

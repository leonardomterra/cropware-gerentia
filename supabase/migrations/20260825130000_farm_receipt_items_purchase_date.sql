-- Gerentia — data por item. Preparo da etapa 5 de docs/CARTOES-E-FATURAS.md.
--
-- POR QUE: a conciliação vai casar cada linha da fatura com a compra que o
-- usuário já lançou. Sem data, ela casa por VALOR e ESTABELECIMENTO apenas — e
-- "R$ 150,00 no posto" aparece três vezes no mesmo mês. Com a data, o par vira
-- praticamente único.
--
-- Uma fatura real lista a data de cada compra; o modelo é que não guardava. A
-- coluna é NULLABLE porque:
--   * os itens que já existem não têm de onde tirar a data;
--   * uma fatura lançada à mão não traz item nenhum;
--   * uma nota fiscal itemizada tem UMA data, a do documento — repeti-la em
--     cada linha seria ruído.
--
-- Ou seja: NULL quer dizer "vale a data do lançamento pai", e a conciliação
-- trata a ausência como critério a menos, não como erro.

alter table public.farm_receipt_items
  add column if not exists purchase_date date;

-- Índice pensado na consulta da conciliação: "as compras deste mês, por valor".
create index if not exists farm_receipt_items_por_data
  on public.farm_receipt_items (organization_id, purchase_date)
  where purchase_date is not null;

comment on column public.farm_receipt_items.purchase_date is
  'Data da compra dentro da fatura. NULL = vale a data do lançamento pai. Terceiro critério da conciliação, junto de valor e estabelecimento.';

-- Item desmembrado ("desagrupar"): em vez de DELETAR o item do pai, o promote
-- agora MARCA o item com o id do lançamento criado. O item continua na nota/
-- fatura, porém esmaecido e FORA do total/item_count (que passam a contar só os
-- ativos, promoted_to_receipt_id IS NULL). on delete set null: se o lançamento
-- desmembrado for excluído, o item volta a ser um item normal? Não — mantemos
-- a marca como histórico só enquanto o destino existir; ao excluí-lo, a marca
-- some (item volta a contar). Aceitável: desmembrar e depois excluir o avulso
-- reintegra o valor ao pai.

alter table public.farm_receipt_items
  add column promoted_to_receipt_id uuid
    references public.farm_receipts(id) on delete set null;

-- Índice parcial: as agregações e o recálculo do pai filtram por itens ATIVOS.
create index farm_receipt_items_active_idx
  on public.farm_receipt_items(receipt_id)
  where promoted_to_receipt_id is null;

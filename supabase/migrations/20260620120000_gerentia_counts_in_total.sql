-- gerentia.app — "Contabilizar no total" (anti-duplicidade cartão × fatura).
--
-- Flag ortogonal por lançamento: quando false, o lançamento aparece nas listas
-- mas NÃO entra nas somas (Dashboard/Relatórios/CSV) — fica "informativo".
--
-- Defaults aplicados no backend ao criar:
--   - Fatura (doc_type='fatura')      -> false (informativo; evita duplicar com
--                                        as compras avulsas de cartão).
--   - Demais lançamentos              -> true.
--   - Item desmembrado da fatura      -> true (vira lançamento próprio que soma).
--
-- O split de payment_method (cartao -> cartao_credito/cartao_debito) é texto
-- livre (sem check constraint), então não precisa de migração — só app/edge.
--
-- Objetos seguem nomeados farm_* (o rebrand não renomeia objetos de banco).

alter table public.farm_receipts
  add column if not exists counts_in_total boolean not null default true;

-- Faturas existentes passam a ser informativas (não somam), alinhando ao novo
-- padrão. Os gastos do cartão entram pelos lançamentos avulsos / desmembrados.
update public.farm_receipts
  set counts_in_total = false
  where doc_type = 'fatura';

-- Índice parcial: as agregações filtram por counts_in_total = true.
create index if not exists farm_receipts_counts_in_total_idx
  on public.farm_receipts(organization_id, transaction_date)
  where counts_in_total = true;

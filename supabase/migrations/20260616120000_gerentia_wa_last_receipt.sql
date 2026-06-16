-- Agente de finanças no WhatsApp: referência ao último lançamento afetado.
--
-- Permite que correções conversacionais ("era 550 não 500", "foi no cartão",
-- "apaga isso") resolvam "isso/esse/aquele" pro lançamento certo mesmo quando
-- ele já saiu da janela de histórico. Setado em todo create/update/mark.
alter table public.farm_whatsapp_links
  add column if not exists last_receipt_id uuid
    references public.farm_receipts(id) on delete set null;

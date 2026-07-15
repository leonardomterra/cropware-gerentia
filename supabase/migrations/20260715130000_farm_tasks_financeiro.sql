-- gerentia.app — Pendências passa a tratar SÓ to-do FINANCEIRO (decisão 15/07).
--
-- O to-do geral ("agendar vistoria do carro") foi adiado pra um app próprio.
-- Com o escopo financeiro, o lembrete ganha VALOR e CENTRO DE CUSTO — os mesmos
-- campos que o card já exibia como placeholder fixo ("R$ 0,00" / "Sem centro").
-- Ambos OPCIONAIS: o lembrete nasce de um "anota: X" no WhatsApp, onde o usuário
-- muitas vezes ainda não sabe o valor.
--
-- Ganho colateral: ao Converter o lembrete em lançamento, o formulário já abre
-- com valor e centro preenchidos.
--
-- Espelha o padrão de farm_receipts.cost_center_id (20260528100000:69):
-- `on delete set null` + índice.

alter table public.farm_tasks
  add column if not exists total_value numeric(14,2),
  add column if not exists cost_center_id uuid references public.farm_cost_centers(id) on delete set null;

create index if not exists farm_tasks_cc_idx on public.farm_tasks(cost_center_id);

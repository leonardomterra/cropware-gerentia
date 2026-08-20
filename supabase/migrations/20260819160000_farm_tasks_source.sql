-- Origem do lembrete: criado na tela ou entrou sozinho pelo WhatsApp.
--
-- POR QUE: na aba Pendências o quadro mistura o que a pessoa anotou com o que
-- chegou por outro canal, e a diferença importa na hora de confiar no dado — um
-- lembrete que veio de "anota: pagar o contador" no WhatsApp foi interpretado
-- por IA e pode ter entendido errado o valor ou a data. Sem esta coluna os dois
-- eram indistinguíveis.
--
-- Os financeiros (Pagar/Receber) já se distinguem por `is_estimated`, que marca
-- o que a recorrência projetou. Esta coluna fecha o mesmo buraco no lembrete.

alter table public.farm_tasks
  add column if not exists source text not null default 'manual';

-- Restrição por último e NÃO VALIDATED de imediato seria o caminho para tabela
-- grande; aqui a tabela é pequena e o default cobre 100% das linhas existentes,
-- então a checagem roda direto.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'farm_tasks_source_check'
  ) then
    alter table public.farm_tasks
      add constraint farm_tasks_source_check
      check (source in ('manual', 'whatsapp', 'telegram'));
  end if;
end $$;

comment on column public.farm_tasks.source is
  'Como o lembrete entrou: manual (tela) ou whatsapp/telegram (interpretado por IA).';

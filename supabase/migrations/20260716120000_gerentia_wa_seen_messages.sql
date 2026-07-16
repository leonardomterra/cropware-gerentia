-- gerentia.app - Dedup PERSISTENTE do webhook WhatsApp.
--
-- Contexto: o dedup de message id vivia num Map em memoria (handlers/whatsapp.ts).
-- Memoria de isolate nao sobrevive a cold start nem e compartilhada entre isolates
-- do Edge Functions, entao um deploy (que mata isolates) fez a Meta reentregar um
-- "Confirmar" e o bot processou 2x. O caminho que grava dinheiro ja e idempotente
-- (claimPending faz DELETE ... RETURNING no farm_wa_pending), mas os passos NAO
-- terminais do wizard ainda avancavam 2x.
--
-- Esta tabela e a AUTORIDADE do dedup: o webhook faz um insert atomico do
-- message_id; conflito de unique (23505) => duplicata. Vale entre isolates.
--
-- So o webhook (service_role) toca aqui — mesmo padrao de farm_wa_pending:
-- RLS habilitado SEM policies -> authenticated nao acessa; service_role bypassa.
create table public.farm_wa_seen_messages (
  message_id text primary key,                 -- id da mensagem da Meta (wamid...)
  created_at timestamptz not null default now()
);

-- Indice pra limpeza por idade (o cron /cron/process-alerts apaga linhas > 24h).
create index farm_wa_seen_messages_created_idx on public.farm_wa_seen_messages(created_at);

alter table public.farm_wa_seen_messages enable row level security;
-- RLS habilitado sem policies -> authenticated nao acessa; service_role bypassa.

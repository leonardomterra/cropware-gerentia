-- gerentia.app rebrand - re-aponta os cron jobs pro novo edge function.
--
-- O edge function 'farm-api' foi renomeado pra 'gerentia-api', entao a URL do
-- pg_net.http_post muda de /functions/v1/farm-api/... pra /functions/v1/gerentia-api/...
--
-- cron.schedule e UPSERT por nome do job: re-chamar com o mesmo nome atualiza o
-- command sem duplicar nem deixar job orfao. Nomes de job (farm-*) sao
-- identificadores internos do pg_cron, mantidos pra nao quebrar referencias.
--
-- O header x-cron-secret continua o mesmo valor; ele precisa bater com o env
-- GERENTIA_CRON_SECRET (que aceita o legado FARM_CRON_SECRET via lib/env.ts).
-- Ao re-setar o secret no Supabase, use o MESMO valor abaixo (ou rotacione os dois).

select cron.schedule(
  'farm-process-alerts',
  '0 9 * * *',
  $$
  select extensions.net.http_post(
    url := 'https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/gerentia-api/cron/process-alerts',
    headers := jsonb_build_object(
      'x-cron-secret', 'farm_alerts_2026_x9k2p3m7',
      'content-type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

select cron.schedule(
  'farm-weekly-summary',
  '0 18 * * 5',
  $$
  select extensions.net.http_post(
    url := 'https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/gerentia-api/cron/weekly-summary',
    headers := jsonb_build_object(
      'x-cron-secret', 'farm_alerts_2026_x9k2p3m7',
      'content-type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

-- Gerentia — conserta os cron jobs de HTTP: `extensions.net` → `net`.
--
-- ACHADO EM 24/08/2026, por acidente, ao testar o cron do backup.
--
-- Os dois jobs que chamam a edge por HTTP NUNCA funcionaram:
--
--   farm-process-alerts    83 falhas desde 03/06/2026, ZERO sucessos
--   farm-weekly-summary    12 falhas desde 05/06/2026, ZERO sucessos
--
-- Ou seja: o alerta de vencimento por WhatsApp e o resumo semanal jamais
-- dispararam em produção. `farm-process-recurring` sempre funcionou porque
-- chama uma função SQL (`public.farm_process_recurring()`), não HTTP.
--
-- CAUSA: o `pg_net` cria as funções no schema `net`, não em `extensions`. Em
-- `extensions.net.http_post(...)` o Postgres lê os três níveis como
-- banco.schema.função e responde:
--
--   ERROR: cross-database references are not implemented: extensions.net.http_post
--
-- O erro fica em `cron.job_run_details` e em lugar nenhum mais: ninguém é
-- notificado, e um job que falha todo dia tem exatamente a mesma aparência de
-- um que nunca teve o que fazer. Foi por isso que passou três meses.
--
-- Confirmação de onde a função mora:
--   select n.nspname, p.proname from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace where p.proname = 'http_post';
--   -> net | http_post
--
-- cron.schedule faz upsert por nome: isto reescreve os três commands sem
-- duplicar job.

select cron.schedule(
  'farm-process-alerts',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/gerentia-api/cron/process-alerts',
    headers := jsonb_build_object(
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gerentia_cron_secret'),
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
  select net.http_post(
    url := 'https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/gerentia-api/cron/weekly-summary',
    headers := jsonb_build_object(
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gerentia_cron_secret'),
      'content-type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

-- O do backup nasceu hoje com o mesmo defeito, herdado por cópia do padrão
-- existente. Corrigido antes da primeira execução.
select cron.schedule(
  'gerentia-daily-backup',
  '0 5 * * *',
  $$
  select net.http_post(
    url := 'https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/gerentia-api/cron/daily-backup',
    headers := jsonb_build_object(
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gerentia_cron_secret'),
      'content-type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

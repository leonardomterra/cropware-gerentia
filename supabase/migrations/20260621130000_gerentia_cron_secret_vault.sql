-- gerentia.app — tira o x-cron-secret hardcoded dos cron jobs (auditoria Etapa 1).
--
-- O segredo do cron estava em texto puro nas migrations (vaza no git/logs).
-- Aqui os jobs passam a LER o valor do Vault, então o literal nunca mais aparece
-- no command do pg_cron nem em migration.
--
-- ⚠️ NÃO RODE esta migração antes de criar o secret no Vault — senão o header
-- vai vazio e o cronGuard rejeita (alertas/resumos param). Ordem correta:
--   1) Gere um valor novo (rotação) e crie no Vault:
--        select vault.create_secret('<NOVO_VALOR>', 'gerentia_cron_secret');
--   2) Aponte o env do edge pro mesmo valor:
--        supabase secrets set GERENTIA_CRON_SECRET=<NOVO_VALOR>
--   3) Aplique esta migração.
-- (cron.schedule faz upsert por nome — atualiza o command sem duplicar.)

select cron.schedule(
  'farm-process-alerts',
  '0 9 * * *',
  $$
  select extensions.net.http_post(
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
  select extensions.net.http_post(
    url := 'https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/gerentia-api/cron/weekly-summary',
    headers := jsonb_build_object(
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gerentia_cron_secret'),
      'content-type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

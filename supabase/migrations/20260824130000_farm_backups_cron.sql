-- Gerentia — o backup diário automático. Etapa 1 de docs/BACKUP-E-RESTAURACAO.md.
--
-- Mesmo padrão dos jobs que já rodam: pg_net chama a rota da edge com o segredo
-- lido do Vault, para o literal nunca aparecer no command nem em migration.
--
-- HORÁRIO: 05:00 UTC = 02:00 de Brasília. Dois motivos, nesta ordem:
--
--  1. ANTES das recorrências, que rodam 07:00 UTC e ESCREVEM lançamentos
--     (`farm_process_recurring`). O retrato do dia tem que ser anterior a
--     qualquer escrita automática — senão o backup do dia já vem com o que o
--     robô criou, e não com o que existia.
--  2. Horário morto no Brasil. Os outros jobs ocupam 07:00 e 09:00 UTC (04h e
--     06h daqui) e sexta 18:00 UTC.
--
-- O fuso do pg_cron neste projeto é GMT (conferido em `current_setting
-- ('cron.timezone')`), então o campo aqui é UTC mesmo — não é horário local.
--
-- A rota também EXPURGA o que passou de `expira_em`, na mesma passada. Quem
-- cria e quem limpa no mesmo lugar, para não existir a hipótese de um rodar
-- por meses sem o outro e a retenção do §6 virar ficção.
--
-- cron.schedule faz upsert por nome: reaplicar atualiza sem duplicar.

select cron.schedule(
  'gerentia-daily-backup',
  '0 5 * * *',
  $$
  select extensions.net.http_post(
    url := 'https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/gerentia-api/cron/daily-backup',
    headers := jsonb_build_object(
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gerentia_cron_secret'),
      'content-type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

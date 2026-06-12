-- gerentia.app R3.2 - Resumo semanal via WhatsApp.
-- pg_cron dispara o endpoint /cron/weekly-summary as 18:00 UTC (15:00 BRT)
-- toda sexta-feira (cron field 5 = sex). Endpoint usa template Meta
-- farm_resumo_semanal pra cada user vinculado.

select cron.schedule(
  'farm-weekly-summary',
  '0 18 * * 5',
  $$
  select extensions.net.http_post(
    url := 'https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/farm-api/cron/weekly-summary',
    headers := jsonb_build_object(
      'x-cron-secret', 'farm_alerts_2026_x9k2p3m7',
      'content-type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

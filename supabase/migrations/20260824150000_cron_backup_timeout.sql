-- Gerentia — dá tempo ao cron do backup. Etapa 1 de docs/BACKUP-E-RESTAURACAO.md.
--
-- A primeira execução real, disparada à mão, registrou em `net._http_response`:
--
--   Timeout of 5000 ms reached. Total time: 5000.541 ms
--   (DNS 18ms, TCP/SSL 64ms, HTTP Request/Response 4917ms)
--
-- 5000 ms é o default de `net.http_post`. A edge NÃO morreu junto — o backup
-- terminou inteiro (11 organizações e 14 usuários, conferidos no índice) —, mas
-- a resposta se perdeu, e é ela que diz se deu certo.
--
-- POR QUE ISSO IMPORTA MAIS DO QUE PARECE: sem a resposta, o único registro da
-- rodada é um "timeout" em `net._http_response`, que tem exatamente a mesma
-- aparência quer o backup tenha funcionado, quer tenha explodido no primeiro
-- alvo. É a mesma cegueira que deixou `farm-process-alerts` falhar 83 vezes sem
-- ninguém perceber (ver 20260824140000_fix_cron_net_schema.sql).
--
-- 120 s cobre folgadamente o volume de hoje (a rodada leva ~17 s para 25
-- pacotes) e dá margem para o banco crescer bastante antes de apertar. Não
-- prende o cron: `pg_net` é assíncrono — o job devolve o request_id na hora e
-- quem espera é o worker de background.
--
-- Os outros dois jobs ficam nos 5000 ms default: mandam poucas mensagens e
-- respondem rápido. Se um dia demorarem, o sintoma vai ser este mesmo.

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
    body := jsonb_build_object(),
    timeout_milliseconds := 120000
  );
  $$
);

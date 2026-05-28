-- Cropware Farm R3.1 - Alertas proativos de vencimento.
-- pg_cron dispara via pg_net.http_post o endpoint /cron/process-alerts da farm-api,
-- que varre farm_receipts pendentes nos proximos 3 dias e envia template WhatsApp
-- pro owner/creator linkado. farm_alert_log evita reenvio.

create extension if not exists pg_net with schema extensions;

create table public.farm_alert_log (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.farm_receipts(id) on delete cascade,
  user_id uuid not null,
  phone_number text not null,
  alert_kind text not null check (alert_kind in ('due_in_3d','due_in_1d','due_today','overdue')),
  sent_at timestamptz not null default now(),
  error text,
  unique (receipt_id, alert_kind)
);

create index farm_alert_log_user_idx on public.farm_alert_log(user_id);
create index farm_alert_log_recent_idx on public.farm_alert_log(sent_at desc);

alter table public.farm_alert_log enable row level security;

create policy "alert log read by org members" on public.farm_alert_log
  for select using (
    exists (
      select 1 from public.farm_receipts fr
        join public.users_meta um on um.organization_id = fr.organization_id
      where fr.id = farm_alert_log.receipt_id and um.user_id = auth.uid()
    )
  );

grant select on public.farm_alert_log to authenticated;

-- Schedule: roda diariamente as 09:00 UTC (06:00 BRT). A chave x-cron-secret
-- abaixo precisa bater com FARM_CRON_SECRET no env da edge function farm-api.
-- Trocar valor periodicamente (UPDATE cron.job SET command = ... + rotacionar env).
select cron.schedule(
  'farm-process-alerts',
  '0 9 * * *',
  $$
  select extensions.net.http_post(
    url := 'https://tzsmxhwvtobwkqffgsxo.supabase.co/functions/v1/farm-api/cron/process-alerts',
    headers := jsonb_build_object(
      'x-cron-secret', 'farm_alerts_2026_x9k2p3m7',
      'content-type', 'application/json'
    ),
    body := jsonb_build_object()
  );
  $$
);

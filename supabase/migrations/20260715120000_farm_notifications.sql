-- gerentia.app — Notificações in-app (persistidas, com lido/não-lido).
--
-- Por que existem: os lembretes proativos por WhatsApp foram parados — a Meta
-- reclassifica os templates de UTILITY p/ MARKETING, o que encarece ~7-9x e,
-- pior, sujeita a mensagem a opt-out (o "sua conta vence amanhã" pode não ser
-- entregue). Ver docs/FUTURAS-FEATURES.md. A notificação in-app é grátis,
-- confiável e não depende da Meta.
--
-- Quem produz: o cron /cron/process-alerts (service_role) — vencimento de
-- contas E de tarefas. Quem consome: a página /notificacoes + o badge do menu.
-- No futuro, push nativo (APNs) apenas ENTREGA estas mesmas linhas.
--
-- Duas divergências deliberadas do padrão das outras tabelas farm_*:
--   1) RLS é PESSOAL (user_id = auth.uid()), não org-wide: notificação é de
--      quem recebe, não da organização.
--   2) SEM grant de insert pro authenticated — só o cron (service_role, que
--      bypassa RLS/grants) produz. Mesma lógica de farm_alert_log.

create table public.farm_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- due_in_3d | due_in_1d | due_today | overdue (mesmos kinds do relativeDay
  -- do cron; sem check pra não travar kinds futuros — o produtor é só o cron).
  kind text not null,
  title text not null,
  body text,

  -- Origem: uma das duas (conta OU tarefa). Ambas nulas = notificação avulsa.
  receipt_id uuid references public.farm_receipts(id) on delete cascade,
  task_id uuid references public.farm_tasks(id) on delete cascade,

  read_at timestamptz,
  created_at timestamptz default now()
);

-- Dedup: o cron roda todo dia e re-veria o mesmo vencimento. O upsert usa estes
-- uniques com ignoreDuplicates. Inclui user_id (diferente do farm_alert_log,
-- cuja chave nao tem user).
--
-- NAO-PARCIAIS de proposito: o ON CONFLICT do PostgREST nao consegue inferir
-- indice parcial (o Postgres exigiria repetir o predicado no ON CONFLICT, o que
-- o PostgREST nao expoe) — o upsert quebraria. Funciona porque NULL e' DISTINTO
-- no Postgres: uma notificacao de tarefa (receipt_id NULL) nunca conflita no
-- indice de receipt, e uma de conta (task_id NULL) nunca conflita no de task.
create unique index farm_notifications_receipt_dedup
  on public.farm_notifications(user_id, receipt_id, kind);
create unique index farm_notifications_task_dedup
  on public.farm_notifications(user_id, task_id, kind);

-- Badge de não-lidas (parcial: só o que interessa) e listagem da página.
create index farm_notifications_unread_idx
  on public.farm_notifications(user_id) where read_at is null;
create index farm_notifications_list_idx
  on public.farm_notifications(user_id, created_at desc);

alter table public.farm_notifications enable row level security;

create policy "notifications are personal" on public.farm_notifications
  for all using (user_id = (select auth.uid()));

-- Sem insert: o usuário lê, marca como lida (update) e limpa (delete).
grant select, update, delete on public.farm_notifications to authenticated;

-- Sem updated_at/trigger: só read_at muda depois de criada.

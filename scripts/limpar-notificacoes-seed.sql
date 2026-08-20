-- Remove as notificações criadas por scripts/seed-notificacoes.sql.
-- Só toca no que tem o marcador '[SEED]' no título — notificação real do cron
-- nunca começa assim.
delete from public.farm_notifications where title like '[SEED]%';

select count(*) as restantes from public.farm_notifications;

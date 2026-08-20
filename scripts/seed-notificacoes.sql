-- Seed de NOTIFICAÇÕES DE TESTE — gerentia.app
-- Como rodar: Supabase Dashboard -> SQL Editor -> cole tudo -> Run.
--        ou: supabase db query --linked -f scripts/seed-notificacoes.sql
--
-- POR QUE ISTO EXISTE: a tela /notificacoes fica vazia até o cron
-- /cron/process-alerts rodar, e a janela dele é curta — de 7 dias atrás a 3
-- dias à frente. Conta vencida em junho não entra, então dá para ter a tela
-- vazia com a caixa de entrada cheia de coisa atrasada.
--
-- Cobre os quatro `kind` que o cron produz (overdue, due_today, due_in_1d,
-- due_in_3d), com lidas e não-lidas, e amarra às contas e lembretes REAIS da
-- org quando existem — assim o clique na notificação leva para a tela certa.
--
-- Reexecutável: apaga antes tudo que tenha o marcador '[SEED]' no título.
-- Para limpar sem recriar, rode scripts/limpar-notificacoes-seed.sql.

do $$
declare
  uid   uuid;
  org   uuid;
  conta record;
  lembr record;
begin
  -- Usuário/organização: o dono do primeiro lembrete da base. Resolver assim
  -- (e não por e-mail fixo) mantém o script utilizável em qualquer ambiente.
  select t.created_by, t.organization_id into uid, org
  from public.farm_tasks t
  order by t.created_at
  limit 1;

  if uid is null then
    raise exception 'Nenhum lembrete na base para resolver usuário/organização.';
  end if;

  delete from public.farm_notifications where title like '[SEED]%';

  -- Uma conta a pagar real, para a notificação ter para onde levar.
  select r.id, r.vendor, r.description, r.total_value
    into conta
  from public.farm_receipts r
  where r.organization_id = org
    and r.direction = 'expense'
    and r.status in ('a_pagar', 'vencido')
  order by r.due_date nulls last
  limit 1;

  select t.id, t.title into lembr
  from public.farm_tasks t
  where t.organization_id = org
  order by t.created_at
  limit 1;

  insert into public.farm_notifications
    (organization_id, user_id, kind, title, body, receipt_id, task_id, read_at, created_at)
  values
    -- VENCIDA e não lida: é a que a tela precisa destacar.
    (org, uid, 'overdue',
     '[SEED] ' || coalesce(conta.vendor, conta.description, 'Conta a pagar'),
     'R$ ' || to_char(coalesce(conta.total_value, 0), 'FM999G999D00') || ' — venceu em 18/08',
     conta.id, null, null, now() - interval '2 hours'),

    -- Vence HOJE, não lida.
    (org, uid, 'due_today',
     '[SEED] Energia da sede',
     'R$ 742,10 — vence hoje',
     null, null, null, now() - interval '5 hours'),

    -- Vence AMANHÃ, não lida, vinda de um lembrete (clique vai p/ Pendências).
    (org, uid, 'due_in_1d',
     '[SEED] ' || coalesce(lembr.title, 'Lembrete'),
     'Lembrete — vence amanhã',
     null, lembr.id, null, now() - interval '1 day'),

    -- Daqui a 3 dias, JÁ LIDA: mostra o estado de lida na lista.
    (org, uid, 'due_in_3d',
     '[SEED] Parcela do trator',
     'R$ 3.180,00 — vence em 3 dias',
     null, null, now() - interval '6 hours', now() - interval '2 days'),

    -- Segunda vencida, JÁ LIDA e mais antiga: dá volume à lista e testa a
    -- ordenação por data.
    (org, uid, 'overdue',
     '[SEED] Fornecedor de ração',
     'R$ 1.940,00 — venceu em 12/08',
     null, null, now() - interval '1 day', now() - interval '4 days');

  raise notice 'Notificações de teste criadas para o usuário %', uid;
end $$;

select kind, title, (read_at is null) as nao_lida, created_at
from public.farm_notifications
where title like '[SEED]%'
order by created_at desc;

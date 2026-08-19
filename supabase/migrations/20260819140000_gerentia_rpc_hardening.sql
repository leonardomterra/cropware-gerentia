-- gerentia.app — Etapa 5: fecha as funções que estavam expostas como RPC pública.
--
-- O Supabase publica TODA função do schema public em /rest/v1/rpc/<nome>. Com o
-- GRANT padrão (PUBLIC), qualquer visitante anônimo — e qualquer usuário logado —
-- podia chamá-las direto, sem passar pela edge function.
--
-- O caso que importava: farm_process_recurring() materializa os lançamentos
-- previstos de TODAS as organizações. Qualquer conta logada disparava isso pela
-- API REST. Não vaza dado (o cron das 07 UTC faz o mesmo), mas é efeito de um
-- cliente sobre todos os outros — mesma família do achado registrado na §10.
--
-- Regra aplicada:
--   helpers de RLS      -> authenticated mantém (a policy é avaliada COMO o
--                          usuário; sem EXECUTE, todo SELECT falharia). anon sai:
--                          as tabelas só dão GRANT pra authenticated, então anon
--                          nunca chega a avaliar essas policies.
--   motor de recorrência -> ninguém além do cron (postgres) e da edge function
--                          (service_role). A API já chamava tudo via service_role.
--   funções de trigger   -> ninguém. Trigger não confere EXECUTE do chamador.

-- ------------------------------------------------------------------
-- Helpers de RLS — mantêm authenticated, perdem anon/PUBLIC
-- ------------------------------------------------------------------
revoke execute on function public.farm_current_org_id()          from public, anon;
revoke execute on function public.farm_current_role()            from public, anon;
revoke execute on function public.farm_can_read_all()            from public, anon;
revoke execute on function public.farm_can_write()               from public, anon;
revoke execute on function public.farm_can_write_others()        from public, anon;
revoke execute on function public.farm_receipt_is_mine(uuid)     from public, anon;

-- ------------------------------------------------------------------
-- Motor de recorrência — só cron (postgres) e edge function (service_role)
-- ------------------------------------------------------------------
revoke execute on function public.farm_process_recurring(integer)
  from public, anon, authenticated;
revoke execute on function public.farm_recurring_materialize_one(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.farm_recurring_cleanup_estimated(uuid)
  from public, anon, authenticated;
revoke execute on function public.farm_recurring_resync_estimated(uuid)
  from public, anon, authenticated;

-- Nenhuma policy referencia mais esta função (o centro de custo deixou de ser
-- regra de visibilidade na Etapa 1); só a edge function chama, via service_role.
revoke execute on function public.farm_user_can_access_cc(uuid, uuid)
  from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Funções de trigger — não existe motivo pra chamada direta
-- ------------------------------------------------------------------
revoke execute on function public.handle_new_farm_user()
  from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

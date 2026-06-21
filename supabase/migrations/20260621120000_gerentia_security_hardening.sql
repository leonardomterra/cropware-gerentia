-- gerentia.app — hardening de segurança (auditoria pré-lançamento, Etapa 1).
--
-- 1) users_meta: as policies de UPDATE não tinham WITH CHECK, então um membro
--    podia se auto-promover (role) ou trocar o próprio organization_id. Adiciona
--    WITH CHECK fixando role/org (sem permitir escalonamento nem troca de org).
-- 2) Pina search_path='' em 2 funções helper (defense-in-depth; corpos já são
--    schema-qualified, então não quebra).
-- 3) farm_categories INSERT: fixa organization_id ao org do usuário.

-- 1) -------------------------------------------------------------------------
-- "user updates own meta": pode editar o próprio perfil, mas NÃO mudar role nem
-- organization_id (subquery vê o valor ANTIGO no snapshot do UPDATE).
alter policy "user updates own meta" on public.users_meta
  with check (
    user_id = (select auth.uid())
    and organization_id is not distinct from public.farm_current_org_id()
    and role = (
      select um.role from public.users_meta um
      where um.user_id = (select auth.uid())
    )
  );

-- "admin updates members": admin/owner edita membros do PRÓPRIO org; o novo
-- estado tem que continuar no mesmo org e o role limitado a admin/member
-- (não dá pra promover a owner nem mover pra outro org).
alter policy "admin updates members" on public.users_meta
  with check (
    organization_id = public.farm_current_org_id()
    and role in ('admin', 'member')
  );

-- 2) -------------------------------------------------------------------------
alter function public.farm_user_can_access_cc(uuid, uuid) set search_path = '';
alter function public.farm_cc_check_limit() set search_path = '';

-- 3) -------------------------------------------------------------------------
alter policy "categories insert own" on public.farm_categories
  with check (
    created_by_user_id = (select auth.uid())
    and is_preset = false
    and organization_id = public.farm_current_org_id()
  );

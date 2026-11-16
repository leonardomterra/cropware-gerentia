-- Corrige "infinite recursion detected in policy for relation users_meta".
--
-- A policy "user updates own meta" (20260621120000_gerentia_security_hardening.sql)
-- impede o usuário de trocar o próprio role comparando com um SELECT na própria
-- users_meta. O Postgres recusa policy que consulta a tabela que ela protege:
-- ao expandir a RLS da subconsulta ele cai de novo em users_meta e aborta.
-- Resultado: TODA edição do próprio perfil (Conta → Perfil: nome, telefone,
-- CPF, cidade, área de atuação) falhava com 500 desde 21/06/2026. Achado em
-- 16/11/2026 ao testar o modo de uso do Field.
--
-- A regra continua a mesma — não muda o próprio role nem a organização —, só
-- que o role atual vem de farm_current_role(), que é SECURITY DEFINER (lê a
-- tabela sem RLS, então não há recursão). Como a função é STABLE, ela enxerga o
-- snapshot do comando: o valor ANTIGO do role, que é o que se quer comparar.

alter policy "user updates own meta" on public.users_meta
  with check (
    user_id = (select auth.uid())
    and organization_id is not distinct from public.farm_current_org_id()
    and role is not distinct from public.farm_current_role()
  );

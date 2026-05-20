-- Cropware Farm V1 - polish baseado em get_advisors security+performance.
--
-- 1. set search_path = '' em farm_set_updated_at (security WARN).
-- 2. 3 indexes em foreign keys ja referenciadas (perf - unindexed_foreign_keys).
-- 3. Wrap auth.uid() em (select auth.uid()) nas 7 policies RLS
--    (perf - auth_rls_initplan, evita re-evaluacao por linha em scale).

alter function public.farm_set_updated_at() set search_path = '';

create index users_meta_org_idx on public.users_meta(organization_id);
create index farm_receipts_created_by_idx on public.farm_receipts(created_by);
create index farm_receipts_farm_idx on public.farm_receipts(farm_id);

drop policy "user reads own meta" on public.users_meta;
create policy "user reads own meta" on public.users_meta
  for select using (user_id = (select auth.uid()));

drop policy "user updates own meta" on public.users_meta;
create policy "user updates own meta" on public.users_meta
  for update using (user_id = (select auth.uid()));

drop policy "org members read own org" on public.organizations;
create policy "org members read own org" on public.organizations
  for select using (
    id in (
      select organization_id from public.users_meta where user_id = (select auth.uid())
    )
  );

drop policy "farms scoped to org" on public.farms;
create policy "farms scoped to org" on public.farms
  for all using (
    organization_id in (
      select organization_id from public.users_meta where user_id = (select auth.uid())
    )
  );

drop policy "receipts scoped to org" on public.farm_receipts;
create policy "receipts scoped to org" on public.farm_receipts
  for all using (
    organization_id in (
      select organization_id from public.users_meta where user_id = (select auth.uid())
    )
  );

drop policy "categories org or preset" on public.farm_categories;
create policy "categories org or preset" on public.farm_categories
  for select using (
    is_preset = true
    or organization_id in (
      select organization_id from public.users_meta where user_id = (select auth.uid())
    )
  );

drop policy "categories write own org" on public.farm_categories;
create policy "categories write own org" on public.farm_categories
  for insert with check (
    organization_id in (
      select organization_id from public.users_meta where user_id = (select auth.uid())
    )
  );

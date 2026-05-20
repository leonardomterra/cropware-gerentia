-- Cropware Farm V1 - migration 3/5: farms.

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  area_ha numeric(10,2),
  city text,
  state text,
  primary_crop text,
  notes text,
  created_at timestamptz default now()
);

alter table public.farms enable row level security;

create policy "farms scoped to org" on public.farms
  for all using (
    organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

create index farms_org_idx on public.farms(organization_id);

grant select, insert, update, delete on public.farms to authenticated;

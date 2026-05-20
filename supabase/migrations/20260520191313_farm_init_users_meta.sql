-- Cropware Farm V1 - migration 2/5: users_meta + policy de organizations.

create table public.users_meta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  role text not null default 'owner',
  full_name text,
  phone text,
  cpf text,
  city text,
  state text,
  whatsapp_linked_at timestamptz,
  telegram_linked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users_meta enable row level security;

create policy "user reads own meta" on public.users_meta
  for select using (user_id = auth.uid());

create policy "user updates own meta" on public.users_meta
  for update using (user_id = auth.uid());

grant select, update on public.users_meta to authenticated;

create policy "org members read own org" on public.organizations
  for select using (
    id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

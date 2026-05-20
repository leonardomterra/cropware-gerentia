-- Cropware Farm V1 - migration 5/5: farm_categories + seed de 15 presets.

create table public.farm_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  color text,
  icon_lucide text,
  direction text not null default 'expense',
  is_preset boolean not null default false,
  created_at timestamptz default now(),
  unique (organization_id, slug)
);

alter table public.farm_categories enable row level security;

create policy "categories org or preset" on public.farm_categories
  for select using (
    is_preset = true
    or organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

create policy "categories write own org" on public.farm_categories
  for insert with check (
    organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.farm_categories to authenticated;

insert into public.farm_categories (slug, name, direction, is_preset, icon_lucide) values
  ('combustivel', 'Combustivel', 'expense', true, 'fuel'),
  ('defensivos', 'Defensivos', 'expense', true, 'spray-can'),
  ('sementes', 'Sementes', 'expense', true, 'sprout'),
  ('fertilizantes', 'Fertilizantes', 'expense', true, 'leaf'),
  ('manutencao', 'Manutencao', 'expense', true, 'wrench'),
  ('pecas', 'Pecas', 'expense', true, 'cog'),
  ('frete', 'Frete', 'expense', true, 'truck'),
  ('servicos', 'Servicos', 'expense', true, 'briefcase'),
  ('alimentacao', 'Alimentacao', 'expense', true, 'utensils'),
  ('arrendamento', 'Arrendamento', 'expense', true, 'home'),
  ('folha', 'Folha de pagamento', 'expense', true, 'users'),
  ('outros_despesa', 'Outros', 'expense', true, 'circle'),
  ('venda_graos', 'Venda de graos', 'income', true, 'wheat'),
  ('venda_gado', 'Venda de gado', 'income', true, 'beef'),
  ('outros_receita', 'Outras receitas', 'income', true, 'circle');

-- Itens de lançamento (line items). farm_receipts = cabeçalho; itens aqui.
-- Cada item tem categoria + centro de custo PROPRIOS (split). RLS espelha
-- farm_receipts (org + role/cc). O backend e' o UNICO escritor de
-- total_value/item_count (sem trigger de DB) - recorrencias seguem header-only.

create table public.farm_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.farm_receipts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position int not null default 0,
  description text,
  category text,
  cost_center_id uuid references public.farm_cost_centers(id) on delete set null,
  quantity numeric(14,3),
  unit_value numeric(14,2),
  total_value numeric(14,2) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index farm_receipt_items_receipt_idx on public.farm_receipt_items(receipt_id);
create index farm_receipt_items_org_cat_idx on public.farm_receipt_items(organization_id, category);
create index farm_receipt_items_org_cc_idx on public.farm_receipt_items(organization_id, cost_center_id);

alter table public.farm_receipt_items enable row level security;

-- Mesma logica do "receipts scoped by role and cc": org + (owner/admin OR
-- cc null OR usuario tem acesso ao cc do item).
create policy "receipt items scoped by role and cc" on public.farm_receipt_items
  for all using (
    organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
    and (
      exists (
        select 1 from public.users_meta
        where user_id = auth.uid()
          and organization_id = farm_receipt_items.organization_id
          and role in ('owner','admin')
      )
      or cost_center_id is null
      or public.farm_user_can_access_cc(auth.uid(), farm_receipt_items.cost_center_id)
    )
  );

grant select, insert, update, delete on public.farm_receipt_items to authenticated;

create trigger farm_receipt_items_set_updated_at
  before update on public.farm_receipt_items
  for each row execute function public.farm_set_updated_at();

-- Contador denormalizado mantido pelo backend. Linhas existentes = 0 (header-only).
alter table public.farm_receipts add column item_count int not null default 0;

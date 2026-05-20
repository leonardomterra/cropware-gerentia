-- Cropware Farm V1 - migration 4/5: farm_receipts + trigger updated_at.
-- A tabela central do V1 - lancamentos de despesa/receita.

create table public.farm_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  farm_id uuid references public.farms(id) on delete set null,

  doc_type text not null,
  direction text not null default 'expense',
  status text not null default 'a_pagar',

  total_value numeric(14,2) not null,
  currency text not null default 'BRL',
  transaction_date date,
  due_date date,
  paid_date date,

  vendor text,
  vendor_cnpj text,
  payment_method text,

  description text,
  category text,
  invoice_number text,
  notes text,

  attachment_key text,
  attachment_mime text,

  source text not null default 'manual',
  ai_confidence numeric(3,2),
  ai_raw jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index farm_receipts_org_date_idx on public.farm_receipts(organization_id, transaction_date desc);
create index farm_receipts_org_status_idx on public.farm_receipts(organization_id, status);
create index farm_receipts_org_due_idx on public.farm_receipts(organization_id, due_date) where due_date is not null;

alter table public.farm_receipts enable row level security;

create policy "receipts scoped to org" on public.farm_receipts
  for all using (
    organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.farm_receipts to authenticated;

create or replace function public.farm_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger farm_receipts_set_updated_at
before update on public.farm_receipts
for each row execute function public.farm_set_updated_at();

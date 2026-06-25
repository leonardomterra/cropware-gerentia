-- gerentia.app — billing (assinatura web via Mercado Pago; RevenueCat depois).
-- Ver docs/FARM-PRICING.md §7. Modelo individual: 1 owner = 1 organização; a
-- assinatura é por organização (created_by guarda quem assinou).
--
-- Tabelas:
--   plans              catálogo de planos (seed aqui; editado por master/service role)
--   billing_customers  payer por provider (email/nome do MP)
--   subscriptions      estado da assinatura por org (fonte de verdade)
--   billing_events     idempotência + auditoria dos webhooks
-- + colunas em organizations pra gating rápido (plan_code já existia).
--
-- Regra dura: toda CREATE TABLE em public precisa de GRANT explícito p/ a Data
-- API não quebrar (42501). billing_events é interno (só service role) — RLS on,
-- sem policy, sem grant a authenticated (intencional).

-- ============================================================
-- 1. plans — catálogo
-- ============================================================
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_cents integer not null,
  currency text not null default 'BRL',
  billing_interval text not null,                 -- monthly | yearly
  active boolean not null default true,
  sort integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

-- Qualquer usuário logado lê o catálogo de planos ativos (pra montar a tela).
create policy "plans readable by authenticated" on public.plans
  for select using (active = true);

grant select on public.plans to authenticated;

-- ============================================================
-- 2. billing_customers — payer por provider
-- ============================================================
create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  provider text not null,                         -- mercadopago | revenuecat
  provider_customer_id text,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, user_id)
);

alter table public.billing_customers enable row level security;

create policy "billing_customers read own" on public.billing_customers
  for select using (user_id = auth.uid());

grant select on public.billing_customers to authenticated;

-- ============================================================
-- 3. subscriptions — estado por organização (fonte de verdade)
-- ============================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  plan_code text not null,
  provider text not null,                         -- mercadopago | revenuecat
  provider_subscription_id text,
  provider_preapproval_id text,
  status text not null default 'pending',         -- pending|active|past_due|canceled|expired|paused
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_org_idx on public.subscriptions(organization_id);
create index subscriptions_provider_ref_idx
  on public.subscriptions(provider, provider_preapproval_id);

alter table public.subscriptions enable row level security;

-- Membros da org leem a assinatura da própria org. Escrita é só service role
-- (edge function reconcilia via webhook) — sem policy de insert/update/delete.
create policy "subscriptions read own org" on public.subscriptions
  for select using (
    organization_id in (
      select organization_id from public.users_meta where user_id = auth.uid()
    )
  );

grant select on public.subscriptions to authenticated;

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.farm_set_updated_at();

-- ============================================================
-- 4. billing_events — idempotência + auditoria (interno)
-- ============================================================
create table public.billing_events (
  id bigserial primary key,
  provider text not null,
  event_type text not null,
  provider_event_id text not null,
  payload jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- RLS on, sem policy, sem grant: só service role (edge) acessa. Intencional.
alter table public.billing_events enable row level security;

-- ============================================================
-- 5. organizations — colunas de gating rápido (plan_code já existe)
-- ============================================================
alter table public.organizations
  add column if not exists subscription_status text,            -- trialing|active|past_due|canceled|expired|paused
  add column if not exists subscription_current_period_end timestamptz;

-- ============================================================
-- 6. Seed dos planos (V1 de lançamento — ver docs/FARM-PRICING.md §3)
-- ============================================================
insert into public.plans (code, name, description, price_cents, currency, billing_interval, sort, metadata) values
  ('gerentia_pro_monthly',  'Gerentia Pro',        'Plano mensal — tudo incluso.',             8900,  'BRL', 'monthly', 10, '{}'::jsonb),
  ('gerentia_pro_yearly',   'Gerentia Pro Anual',  'Plano anual — 2 meses grátis (paga 10).', 89000, 'BRL', 'yearly',  20, '{}'::jsonb)
on conflict (code) do nothing;

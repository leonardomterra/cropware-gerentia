-- Cropware Farm - infra de WhatsApp (Fase A).
--
-- 3 tabelas:
-- - farm_whatsapp_links: vinculo telefone -> user/org (resolvido pelo webhook).
-- - farm_whatsapp_link_codes: codigos de 6 digitos pendentes (gerados no app web).
-- - farm_wa_pending: estado curto por telefone (ex: recibo escaneado aguardando
--   confirmacao no chat). TTL via expires_at.
--
-- O webhook e PUBLICO (sem JWT) -> le/escreve via service_role (bypassa RLS).
-- O app web (authenticated) so enxerga o proprio vinculo e gera os proprios codigos.

-- ============ Vinculos ativos ============
create table public.farm_whatsapp_links (
  phone_number text primary key,                 -- E.164 sem '+', ex: 5564999998888
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_name text,
  is_active boolean not null default true,
  linked_at timestamptz default now(),
  last_message_at timestamptz,
  created_at timestamptz default now()
);

create index farm_wa_links_user_idx on public.farm_whatsapp_links(user_id);
create index farm_wa_links_org_idx on public.farm_whatsapp_links(organization_id);

alter table public.farm_whatsapp_links enable row level security;

-- App web le o proprio vinculo (pra mostrar "WhatsApp conectado"). Escrita e
-- exclusiva do webhook (service_role) -> sem policy de insert/update/delete.
create policy "user reads own wa link" on public.farm_whatsapp_links
  for select using (user_id = auth.uid());

grant select on public.farm_whatsapp_links to authenticated;

-- ============ Codigos de vinculo (6 digitos) ============
create table public.farm_whatsapp_link_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_name text,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index farm_wa_codes_code_idx on public.farm_whatsapp_link_codes(code) where used = false;

alter table public.farm_whatsapp_link_codes enable row level security;

-- App web gera/le/apaga os proprios codigos. O webhook valida via service_role.
create policy "user manages own link codes" on public.farm_whatsapp_link_codes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, delete on public.farm_whatsapp_link_codes to authenticated;

-- ============ Estado curto por telefone ============
-- Ex: { kind: 'receipt_confirm', data: {extracted, attachment_key, ...} }.
-- So o webhook (service_role) toca aqui; sem grants pra authenticated.
create table public.farm_wa_pending (
  phone_number text primary key,
  kind text not null,
  data jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

alter table public.farm_wa_pending enable row level security;
-- RLS habilitado sem policies -> authenticated nao acessa; service_role bypassa.

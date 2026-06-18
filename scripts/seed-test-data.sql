-- Seed de DADOS DE TESTE — gerentia.app
-- Como rodar: Supabase Dashboard -> SQL Editor -> cole tudo -> Run.
-- Resolve org/usuário/centro de custo pelo email; cria lançamentos simples,
-- notas/recibos e faturas (com e sem itens), tudo em Junho/2026.
-- Reexecutável: apaga antes os registros marcados com notes = '[SEED]'.

do $$
declare
  uid uuid;
  org uuid;
  cc  uuid;
  rid uuid;
begin
  -- 1) Resolver org/usuário A PARTIR DE UM LANÇAMENTO QUE O APP JÁ MOSTRA.
  -- Isso garante que o seed cai na MESMA org que você está vendo (evita o
  -- problema de cair numa conta/org diferente quando há vários usuários).
  -- Troque os vendors abaixo se nenhum existir mais na sua lista.
  select organization_id, created_by into org, uid
  from public.farm_receipts
  where upper(coalesce(vendor, '')) in
    ('POSTO 15', 'TACO JEANS', 'CARTÃO DE CRÉDITO', 'LAUDO', 'INTERNET UBERABA')
  order by created_at desc
  limit 1;

  -- Fallback: pelo email (caso você tenha apagado todos os lançamentos antigos)
  if org is null then
    select u.id into uid from auth.users u
    where lower(u.email) = lower('leonardoterra.comercial@gmail.com') limit 1;
    select organization_id into org from public.users_meta where user_id = uid;
  end if;
  if org is null or uid is null then
    raise exception 'Não consegui resolver org/usuário. Me diga o email do app.';
  end if;

  select id into cc
  from public.farm_cost_centers
  where organization_id = org and archived_at is null
  order by is_default desc, created_at asc
  limit 1; -- pode ficar null se não houver CC; tudo bem

  -- 0) Limpa seeds anteriores em QUALQUER org (remove os que caíram na org
  -- errada numa execução anterior). Marcador é exclusivo: notes = '[SEED]'.
  delete from public.farm_receipts where notes = '[SEED]';

  -- 2) LANÇAMENTOS SIMPLES (sem itens) ------------------------------------
  insert into public.farm_receipts
    (organization_id, created_by, doc_type, direction, status, total_value,
     transaction_date, paid_date, vendor, category, cost_center_id, item_count, source, notes)
  values
    (org, uid, 'cupom', 'expense', 'pago',   350.00, '2026-06-05', '2026-06-05',
     'POSTO VALE DO SOL', 'combustivel', cc, 0, 'manual', '[SEED]'),
    (org, uid, 'outro', 'expense', 'pago',    90.00, '2026-06-08', '2026-06-08',
     'CLARO INTERNET', 'outros_despesa', cc, 0, 'manual', '[SEED]');

  insert into public.farm_receipts
    (organization_id, created_by, doc_type, direction, status, total_value,
     transaction_date, due_date, vendor, category, cost_center_id, item_count, source, notes)
  values
    (org, uid, 'boleto', 'expense', 'a_pagar', 1200.00, '2026-06-12', '2026-06-28',
     'AGRO LOJA INSUMOS', 'defensivos', cc, 0, 'manual', '[SEED]'),
    (org, uid, 'pix',    'expense', 'vencido',  90.00,  '2026-06-01', '2026-06-03',
     'INTERNET UBERABA', 'outros_despesa', cc, 0, 'manual', '[SEED]');

  -- Receitas simples
  insert into public.farm_receipts
    (organization_id, created_by, doc_type, direction, status, total_value,
     transaction_date, due_date, vendor, category, cost_center_id, item_count, source, notes)
  values
    (org, uid, 'outro', 'income', 'a_receber', 4500.00, '2026-06-14', '2026-06-30',
     'LATICINIO BOA VISTA', 'venda_gado', cc, 0, 'manual', '[SEED]');

  -- 3) RECIBO simples (item único) -> aparece em Notas e Recibos --------
  insert into public.farm_receipts
    (organization_id, created_by, doc_type, direction, status, total_value,
     transaction_date, paid_date, vendor, category, cost_center_id, item_count, source, notes)
  values
    (org, uid, 'recibo', 'income', 'recebido', 8000.00, '2026-06-10', '2026-06-10',
     'COOPERATIVA XYZ', 'venda_graos', cc, 0, 'manual', '[SEED]');

  -- 4) NOTA FISCAL com itens (categorias diferentes) --------------------
  insert into public.farm_receipts
    (organization_id, created_by, doc_type, direction, status, total_value,
     transaction_date, paid_date, vendor, category, cost_center_id, item_count, source, notes)
  values
    (org, uid, 'nota_fiscal', 'expense', 'pago', 3500.00, '2026-06-09', '2026-06-09',
     'AGRO INSUMOS LTDA', null, null, 3, 'manual', '[SEED]')
  returning id into rid;
  insert into public.farm_receipt_items
    (receipt_id, organization_id, position, description, category, cost_center_id, quantity, unit_value, total_value)
  values
    (rid, org, 0, 'UREIA 50KG',        'fertilizantes', cc, 10, 150.00, 1500.00),
    (rid, org, 1, 'GLIFOSATO 5L',      'defensivos',    cc,  4, 200.00,  800.00),
    (rid, org, 2, 'SEMENTE DE MILHO',  'sementes',      cc, null, null,  1200.00);

  -- 5) CUPOM com itens (multi) -> aparece em Notas e Recibos ------------
  insert into public.farm_receipts
    (organization_id, created_by, doc_type, direction, status, total_value,
     transaction_date, paid_date, vendor, category, cost_center_id, item_count, source, notes)
  values
    (org, uid, 'cupom', 'expense', 'pago', 250.00, '2026-06-11', '2026-06-11',
     'SUPERMERCADO CAMPO BOM', null, null, 2, 'manual', '[SEED]')
  returning id into rid;
  insert into public.farm_receipt_items
    (receipt_id, organization_id, position, description, category, cost_center_id, total_value)
  values
    (rid, org, 0, 'MARMITAS EQUIPE', 'alimentacao', cc, 200.00),
    (rid, org, 1, 'AGUA MINERAL',    'alimentacao', cc,  50.00);

  -- 6) FATURA de cartão com itens (várias compras) -> aba Faturas -------
  insert into public.farm_receipts
    (organization_id, created_by, doc_type, direction, status, total_value,
     transaction_date, due_date, vendor, category, cost_center_id, item_count, source, notes)
  values
    (org, uid, 'fatura', 'expense', 'a_pagar', 1300.00, '2026-06-20', '2026-06-20',
     'CARTAO BANCO X', null, null, 4, 'manual', '[SEED]')
  returning id into rid;
  insert into public.farm_receipt_items
    (receipt_id, organization_id, position, description, category, cost_center_id, total_value)
  values
    (rid, org, 0, 'POSTO SHELL',        'combustivel', cc, 600.00),
    (rid, org, 1, 'LOJA DE PECAS',      'pecas',       cc, 350.00),
    (rid, org, 2, 'RESTAURANTE',        'alimentacao', cc, 120.00),
    (rid, org, 3, 'MERCADO CENTRAL',    'alimentacao', cc, 230.00);

  -- 7) Segunda FATURA (paga) -------------------------------------------
  insert into public.farm_receipts
    (organization_id, created_by, doc_type, direction, status, total_value,
     transaction_date, paid_date, vendor, category, cost_center_id, item_count, source, notes)
  values
    (org, uid, 'fatura', 'expense', 'pago', 1300.00, '2026-06-15', '2026-06-15',
     'CARTAO EMPRESARIAL', null, null, 2, 'manual', '[SEED]')
  returning id into rid;
  insert into public.farm_receipt_items
    (receipt_id, organization_id, position, description, category, cost_center_id, total_value)
  values
    (rid, org, 0, 'OFICINA TRATOR', 'manutencao', cc, 900.00),
    (rid, org, 1, 'FRETE GRAOS',    'frete',      cc, 400.00);

  raise notice 'Seed concluído para org %.', org;
end $$;

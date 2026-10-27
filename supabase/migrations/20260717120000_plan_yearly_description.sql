-- Ajuste do texto do plano anual na tela de assinatura: remove o "(paga 10)".
-- A linha já existe no banco (seed de 20260625120000), então o seed não a
-- reescreve — daí este UPDATE explícito.
update public.plans
set description = 'Plano anual — 2 meses grátis.'
where code = 'gerentia_pro_yearly';

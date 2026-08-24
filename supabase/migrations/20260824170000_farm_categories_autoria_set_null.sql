-- Gerentia — `farm_categories.created_by_user_id` deixa de CASCATEAR.
--
-- A migração 20260819150000 tornou a categoria custom propriedade da ORGANIZAÇÃO
-- e deixou escrito, com todas as letras, que "created_by_user_id fica só como
-- autoria/auditoria". A constraint nunca foi ajustada para acompanhar: continuou
-- ON DELETE CASCADE, ou seja, apagar o autor apaga categorias que são da
-- organização, não dele.
--
-- A incoerência fica evidente ao lado da tabela irmã, que faz o certo:
--
--   farm_categories       created_by_user_id  ON DELETE CASCADE    <- errado
--   farm_category_groups  created_by_user_id  ON DELETE SET NULL   <- certo
--
-- RISCO REAL, não teórico. Hoje as 67 categorias com autor preenchido são TODAS
-- do mesmo usuário — é o plano de contas da Querência, o cliente com contabilidade
-- própria. Ele está protegido por acidente: tem 3 lançamentos, e a FK NO ACTION
-- de farm_receipts.created_by barra a exclusão dele. Se esses lançamentos
-- saírem, apagá-lo levaria o plano inteiro, enquanto os 12 grupos dele
-- SOBREVIVERIAM com autor nulo. Meio destruído — pior que qualquer extremo.
--
-- Achado em 24/08/2026 ao conferir as FK com pg_constraint, depois de descobrir
-- que information_schema esconde constraints sobre objetos sem privilégio.

alter table public.farm_categories
  drop constraint if exists farm_categories_created_by_user_id_fkey;

alter table public.farm_categories
  add constraint farm_categories_created_by_user_id_fkey
  foreign key (created_by_user_id) references auth.users(id) on delete set null;

comment on column public.farm_categories.created_by_user_id is
  'Autoria apenas. A categoria custom é da ORGANIZAÇÃO (migração 20260819150000): apagar o autor não pode levar a categoria junto — daí o SET NULL.';

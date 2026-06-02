-- Adiciona o preset "Taxas Diversas" no grupo Financeiro (despesa).
-- Preset global (organization_id null, is_preset true). Idempotente.
insert into public.farm_categories (slug, name, direction, is_preset, icon_lucide, group_name)
select 'taxas_diversas', 'Taxas Diversas', 'expense', true, 'coins', 'Financeiro'
where not exists (
  select 1 from public.farm_categories
  where slug = 'taxas_diversas' and is_preset = true
);

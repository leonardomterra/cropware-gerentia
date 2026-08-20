-- Área de atuação do usuário (Perfil, na tela de Conta).
--
-- POR QUE: "profissão" em campo livre produz mil grafias para a mesma coisa
-- ("produtor", "produtor rural", "agricultor", "fazendeiro") e não serve para
-- nada depois. Área de atuação é uma lista curta e fechada, que dá para agrupar
-- — útil para entender quem usa o app e, mais adiante, para adaptar categorias
-- e relatórios ao perfil de quem entra.
--
-- SEM CHECK CONSTRAINT, de propósito: a lista de áreas vai crescer conforme
-- aparecem clientes de outros ramos, e cada acréscimo exigiria uma migração só
-- para liberar um valor novo. Mesmo raciocínio do `kind` em farm_notifications.
-- Quem restringe é o <select> da tela; o banco guarda o slug.
--
-- Opcional (nullable, sem default): quem não quiser informar deixa em branco, e
-- NULL diz "não informado" sem se confundir com nenhuma área real.

alter table public.users_meta
  add column if not exists activity_area text;

comment on column public.users_meta.activity_area is
  'Área de atuação declarada no Perfil: produtor_rural, autonomo, empresario, profissional_liberal, servidor_publico, assalariado, aposentado, estudante, outro. Sem check — a lista cresce pela interface.';

/**
 * Áreas de atuação — a MESMA lista para o Perfil (tela de Conta) e para o
 * painel do master, que editam a mesma coluna `users_meta.activity_area`.
 *
 * Lista fechada, e não campo livre: "profissão" digitada à mão vira mil grafias
 * para a mesma coisa ("produtor", "agricultor", "fazendeiro") e não serve para
 * agrupar nada depois.
 *
 * O banco guarda o SLUG; o rótulo pode mudar sem migração de dado.
 */
export const AREAS_DE_ATUACAO: { valor: string; rotulo: string }[] = [
  { valor: "produtor_rural", rotulo: "Produtor Rural" },
  { valor: "autonomo", rotulo: "Autônomo" },
  { valor: "empresario", rotulo: "Empresário" },
  { valor: "profissional_liberal", rotulo: "Profissional Liberal" },
  { valor: "servidor_publico", rotulo: "Servidor Público" },
  { valor: "assalariado", rotulo: "Assalariado (CLT)" },
  { valor: "aposentado", rotulo: "Aposentado" },
  { valor: "estudante", rotulo: "Estudante" },
  { valor: "outro", rotulo: "Outro" },
];

/**
 * Modo de uso do módulo Field — coluna `users_meta.field_mode`.
 *
 * Uma pergunta direta, e não deduzida da Área de atuação: um agrônomo pode
 * trabalhar numa fazenda só ou atender vinte produtores, e a profissão não diz
 * qual dos dois. O que o modo decide é se o app mostra o nível **Produtores**
 * acima das fazendas.
 *
 * Escolhido no cadastro; editável pelo próprio usuário (Conta) e pelo master.
 * NULL no banco = "fazenda".
 */
export type ModoDeUso = "fazenda" | "consultor";

export const MODOS_DE_USO: {
  valor: ModoDeUso;
  rotulo: string;
  detalhe: string;
}[] = [
  {
    valor: "fazenda",
    rotulo: "Cuido da minha fazenda",
    detalhe: "Ou da fazenda onde trabalho.",
  },
  {
    valor: "consultor",
    rotulo: "Atendo vários produtores",
    detalhe: "Consultor, agrônomo, revenda, AT, DM, RTV…",
  },
];

export function rotuloDoModo(modo: string | null | undefined): string {
  return (
    MODOS_DE_USO.find((m) => m.valor === modo)?.rotulo ?? MODOS_DE_USO[0].rotulo
  );
}

/** O nível Produtores só aparece para quem atende vários produtores. */
export function mostraProdutores(modo: string | null | undefined): boolean {
  return modo === "consultor";
}

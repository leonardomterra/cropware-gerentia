/**
 * Nome repetido: "Faz São João", "FAZ SAO JOAO" e " faz  são joão " são o mesmo
 * nome. O banco só barra a diferença de maiúscula (índice em lower(name)); a
 * tela barra também acento e espaço, antes de chegar lá.
 */
export function normalizarNome(nome: string): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function acharRepetido<T extends { id: string; name: string }>(
  itens: ReadonlyArray<T>,
  nome: string,
  ignorarId?: string | null,
): T | null {
  const alvo = normalizarNome(nome);
  if (!alvo) return null;
  return (
    itens.find((i) => i.id !== ignorarId && normalizarNome(i.name) === alvo) ??
    null
  );
}

/**
 * "12,5", "12.5" ou "1.234,5" → número; vazio/inválido → null. Com vírgula, o
 * ponto é separador de milhar; sem vírgula, o ponto é a casa decimal.
 */
export function lerNumero(texto: string): number | null {
  const bruto = texto.trim();
  const t = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto;
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 12.5 → "12,5" para campo de texto. */
export function numeroParaCampo(n: number | null | undefined): string {
  return n == null ? "" : String(n).replace(".", ",");
}

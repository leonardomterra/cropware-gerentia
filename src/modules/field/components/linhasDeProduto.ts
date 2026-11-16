import type { ProdutoDaAtividade } from "../dominio/atividades";
import { lerNumero, numeroParaCampo } from "../utils/nomes";

/** Linha de produto em edição: números como TEXTO (vírgula decimal). */
export interface LinhaDeProduto {
  chave: string;
  nome: string;
  produto_id: string | null;
  tipo: string;
  dose: string;
  unidade: string;
  custo_ha: string;
}

export const linhaVazia = (): LinhaDeProduto => ({
  chave: crypto.randomUUID(),
  nome: "",
  produto_id: null,
  tipo: "",
  dose: "",
  unidade: "L/ha",
  custo_ha: "",
});

export function linhasDe(produtos: ProdutoDaAtividade[]): LinhaDeProduto[] {
  return produtos.map((p) => ({
    chave: crypto.randomUUID(),
    nome: p.nome,
    produto_id: p.produto_id ?? null,
    tipo: p.tipo ?? "",
    dose: numeroParaCampo(p.dose),
    unidade: p.unidade ?? "L/ha",
    custo_ha: numeroParaCampo(p.custo_ha),
  }));
}

export function produtosDe(linhas: LinhaDeProduto[]): ProdutoDaAtividade[] {
  return linhas
    .filter((l) => l.nome.trim())
    .map((l) => ({
      produto_id: l.produto_id,
      nome: l.nome.trim(),
      tipo: l.tipo || null,
      dose: lerNumero(l.dose),
      unidade: l.unidade || null,
      custo_ha: lerNumero(l.custo_ha),
    }));
}

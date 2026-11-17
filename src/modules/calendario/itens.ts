/**
 * Itens do Calendário único — financeiro e campo na mesma grade (fase 3 da
 * unificação, docs/UNIFICACAO-FIELD.md). Função pura: recebe o que as telas já
 * carregam e devolve uma lista comum, para a grade não saber de onde veio cada
 * coisa.
 *
 * Somente leitura: o clique leva à tela de origem (`destino`), onde se edita.
 */
export type Categoria =
  | "pendencia"
  | "pagar"
  | "receber"
  | "atividade"
  | "plantio";
export type Situacao = "atrasado" | "pendente" | "planejado" | "feito";

export interface ItemDoCalendario {
  id: string;
  /** "aaaa-mm-dd" */
  data: string;
  hora: string | null;
  titulo: string;
  detalhe: string | null;
  categoria: Categoria;
  situacao: Situacao;
  /** Para onde o clique leva (rota com o ?abrir= / ?open=). */
  destino: string;
  farmId: string | null;
}

export const CATEGORIAS: Record<Categoria, { rotulo: string; cor: string }> = {
  pendencia: { rotulo: "Pendências", cor: "#059669" },
  pagar: { rotulo: "A pagar", cor: "#dc2626" },
  receber: { rotulo: "A receber", cor: "#2563eb" },
  atividade: { rotulo: "Atividades", cor: "#7c3aed" },
  plantio: { rotulo: "Plantios e colheitas", cor: "#ca8a04" },
};

export const ROTULO_DA_SITUACAO: Record<Situacao, string> = {
  atrasado: "Atrasado",
  pendente: "Pendente",
  planejado: "Planejado",
  feito: "Feito",
};

// ---- Entradas (só o que importa de cada fonte) ------------------------------
export interface PendenciaIn {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  done: boolean;
  farm_id: string | null;
  location: string | null;
}
export interface LancamentoIn {
  id: string;
  due_date: string | null;
  direction: "expense" | "income";
  status: string;
  vendor: string | null;
  description: string | null;
  total_value: number;
  farm_id: string | null;
}
export interface AtividadeIn {
  id: string;
  date: string;
  status: "planejada" | "realizada";
  rotuloDoTipo: string;
  onde: string;
  farm_id: string;
}
export interface PlantioIn {
  id: string;
  nome: string;
  onde: string;
  farm_id: string | null;
  planting_date: string | null;
  expected_harvest_date: string | null;
  lifecycle: "planned" | "active" | "completed";
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Vencido e ainda aberto → atrasado; senão o estado "em espera" da fonte. */
const situacao = (
  data: string,
  hoje: string,
  feito: boolean,
  espera: Situacao,
): Situacao => (feito ? "feito" : data < hoje ? "atrasado" : espera);

export function montarItens(
  fontes: {
    pendencias: PendenciaIn[];
    lancamentos: LancamentoIn[];
    atividades: AtividadeIn[];
    plantios: PlantioIn[];
  },
  hoje: string,
): ItemDoCalendario[] {
  const itens: ItemDoCalendario[] = [];

  for (const t of fontes.pendencias) {
    if (!t.due_date) continue;
    itens.push({
      id: `t:${t.id}`,
      data: t.due_date,
      hora: t.due_time ? t.due_time.slice(0, 5) : null,
      titulo: t.title,
      detalhe: t.location,
      categoria: "pendencia",
      situacao: situacao(t.due_date, hoje, t.done, "pendente"),
      destino: `/pendencias?abrir=${t.id}`,
      farmId: t.farm_id,
    });
  }

  for (const r of fontes.lancamentos) {
    // Só conta em aberto com vencimento: pago/recebido/cancelado não é agenda.
    if (!r.due_date || !["a_pagar", "a_receber", "vencido"].includes(r.status))
      continue;
    const pagar = r.direction === "expense";
    itens.push({
      id: `r:${r.id}`,
      data: r.due_date,
      hora: null,
      titulo:
        r.vendor ||
        r.description ||
        (pagar ? "Conta a pagar" : "Conta a receber"),
      detalhe: brl(Number(r.total_value) || 0),
      categoria: pagar ? "pagar" : "receber",
      situacao:
        r.status === "vencido"
          ? "atrasado"
          : situacao(r.due_date, hoje, false, "pendente"),
      destino: `/lancamentos?open=${r.id}`,
      farmId: r.farm_id,
    });
  }

  for (const a of fontes.atividades) {
    itens.push({
      id: `a:${a.id}`,
      data: a.date,
      hora: null,
      titulo: a.rotuloDoTipo,
      detalhe: a.onde,
      categoria: "atividade",
      situacao: situacao(a.date, hoje, a.status === "realizada", "planejado"),
      destino: `/campo/atividades?abrir=${a.id}`,
      farmId: a.farm_id,
    });
  }

  for (const p of fontes.plantios) {
    if (p.planting_date) {
      itens.push({
        id: `p:${p.id}`,
        data: p.planting_date,
        hora: null,
        titulo: `Plantio: ${p.nome}`,
        detalhe: p.onde,
        categoria: "plantio",
        situacao: p.lifecycle === "planned" ? "planejado" : "feito",
        destino: `/campo/plantios?abrir=${p.id}`,
        farmId: p.farm_id,
      });
    }
    if (p.expected_harvest_date) {
      itens.push({
        id: `c:${p.id}`,
        data: p.expected_harvest_date,
        hora: null,
        titulo: `Colheita prevista: ${p.nome}`,
        detalhe: p.onde,
        categoria: "plantio",
        situacao: situacao(
          p.expected_harvest_date,
          hoje,
          p.lifecycle === "completed",
          "planejado",
        ),
        destino: `/campo/plantios?abrir=${p.id}`,
        farmId: p.farm_id,
      });
    }
  }

  return itens.sort(
    (x, y) =>
      x.data.localeCompare(y.data) ||
      (x.hora ?? "99").localeCompare(y.hora ?? "99") ||
      x.titulo.localeCompare(y.titulo),
  );
}

/** Filtros da tela: categorias ligadas (vazio = todas) e fazenda. */
export function filtrar(
  itens: ItemDoCalendario[],
  categorias: Set<Categoria>,
  farmId: string | null,
): ItemDoCalendario[] {
  return itens.filter(
    (i) =>
      (categorias.size === 0 || categorias.has(i.categoria)) &&
      (!farmId || i.farmId === farmId),
  );
}

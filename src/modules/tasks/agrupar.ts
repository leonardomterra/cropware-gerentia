import type { Task, TaskKind } from "./types";

/**
 * Grupos da coluna de lembretes — a lista plana da Agenda do Flag Field punha
 * evento velho no topo; aqui o que importa hoje vem primeiro.
 */
export type GrupoDePendencia =
  | "atrasados"
  | "hoje"
  | "proximos"
  | "depois"
  | "sem_data"
  | "resolvidos";

export const ROTULO_DO_GRUPO: Record<GrupoDePendencia, string> = {
  atrasados: "Atrasados",
  hoje: "Hoje",
  proximos: "Próximos 7 dias",
  depois: "Depois",
  sem_data: "Sem data",
  resolvidos: "Resolvidos",
};

export const ORDEM_DOS_GRUPOS: GrupoDePendencia[] = [
  "atrasados",
  "hoje",
  "proximos",
  "depois",
  "sem_data",
  "resolvidos",
];

/** Soma dias a uma data ISO "aaaa-mm-dd" sem tropeçar em fuso. */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

export function grupoDe(
  t: Pick<Task, "done" | "due_date">,
  hoje: string,
): GrupoDePendencia {
  if (t.done) return "resolvidos";
  if (!t.due_date) return "sem_data";
  if (t.due_date < hoje) return "atrasados";
  if (t.due_date === hoje) return "hoje";
  if (t.due_date <= somarDias(hoje, 7)) return "proximos";
  return "depois";
}

/** Agrupa mantendo a ordem de entrada dentro de cada grupo. */
export function agrupar<T extends Pick<Task, "done" | "due_date">>(
  itens: T[],
  hoje: string,
): { grupo: GrupoDePendencia; itens: T[] }[] {
  const mapa = new Map<GrupoDePendencia, T[]>();
  for (const t of itens) {
    const g = grupoDe(t, hoje);
    mapa.set(g, [...(mapa.get(g) ?? []), t]);
  }
  return ORDEM_DOS_GRUPOS.filter((g) => mapa.has(g)).map((g) => ({
    grupo: g,
    itens: mapa.get(g)!,
  }));
}

/** Tipos da agenda (check farm_tasks_kind_check). */
export const TIPOS_DE_PENDENCIA: Record<TaskKind, string> = {
  lembrete: "Lembrete",
  reuniao: "Reunião",
  visita: "Visita",
  deslocamento: "Deslocamento",
  manutencao: "Manutenção",
  outro: "Outro",
};

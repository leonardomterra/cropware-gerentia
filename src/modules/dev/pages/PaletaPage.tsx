import type { ComponentType, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useTema } from "@/lib/tema";
import {
  CATEGORIAS,
  MARCA,
  OUTROS,
  STATUS,
  corDaCategoria,
  type PapelDeStatus,
} from "@/lib/paleta";
import { TIPOS } from "@/modules/field/dominio/atividades";
import { TIPOS_DE_ENSAIO } from "@/modules/field/dominio/ensaios";
import { FINALIDADES } from "@/modules/field/dominio/plantios";
import { CORES_DE_CULTURA } from "@/modules/field/dominio/painelDaSafra";
import { CATEGORIAS as CATEGORIAS_DO_CALENDARIO } from "@/modules/calendario/itens";
import { CC_COLORS } from "@/modules/cost-centers/types";
import { ACENTO, FUNDO } from "@/modules/reports/reportTheme";
import IconeSucesso from "~icons/ph/check-circle-fill";
import IconeAtencao from "~icons/ph/warning-fill";
import IconePerigo from "~icons/ph/x-circle-fill";
import IconeInfo from "~icons/ph/info-fill";
import IconePlanta from "~icons/ph/plant-fill";
import IconeGrafico from "~icons/ph/chart-bar-fill";
import IconeCalendario from "~icons/ph/calendar-dots-fill";
import IconeArquivo from "~icons/ph/file-text-fill";
import IconeLixo from "~icons/ph/trash-fill";
import IconeMais from "~icons/ph/plus-bold";

/**
 * PALETA (DEV, fora de produção). Rota: /paleta. 17/11/2026.
 *
 * Duas metades:
 * - HOJE: o que o app usa, lido das PRÓPRIAS listas do código (importadas, não
 *   copiadas) — se alguém mudar uma cor no domínio, o diagnóstico muda junto.
 * - PROPOSTA: `src/lib/paleta.ts`, aplicada em componentes de verdade, nos
 *   dois temas (o botão no topo troca o tema do app).
 */

// ------------------------------------------------------------ utilidades

/** Matiz OKLCH de um hex, para agrupar cores "da mesma família". */
function oklch(hex: string): { L: number; C: number; H: number } {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb), H: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

/** Matiz do 500 de cada família do Tailwind v4. */
const FAMILIAS: [string, number][] = [
  ["vermelho", 25.3], ["rosa-claro", 16.4], ["laranja", 47.6], ["âmbar", 70.1],
  ["amarelo", 85.9], ["lima", 131.7], ["verde", 149.6], ["esmeralda", 162.5],
  ["verde-água", 182.5], ["ciano", 215.2], ["céu", 237.3], ["azul", 259.8],
  ["anil", 277.1], ["violeta", 292.7], ["roxo", 303.9], ["fúcsia", 322.2],
  ["rosa", 354.3],
];
function familia(hex: string): string {
  const { C, H } = oklch(hex);
  if (C < 0.06) return "cinza";
  let melhor = FAMILIAS[0];
  let dist = 999;
  for (const f of FAMILIAS) {
    const d = Math.min(Math.abs(f[1] - H), 360 - Math.abs(f[1] - H));
    if (d < dist) [melhor, dist] = [f, d];
  }
  return melhor[0];
}

/** Toda cor de dado declarada hoje no código, com o que ela significa. */
interface UsoDeCor {
  hex: string;
  significado: string;
  onde: string;
}
const USOS_HOJE: UsoDeCor[] = [
  ...Object.values(TIPOS).map((t) => ({ hex: t.cor, significado: t.rotulo, onde: "Tipo de atividade" })),
  ...Object.values(TIPOS_DE_ENSAIO).map((t) => ({ hex: t.cor, significado: t.rotulo, onde: "Categoria de ensaio" })),
  ...Object.values(FINALIDADES).map((t) => ({ hex: t.cor, significado: t.rotulo, onde: "Finalidade do plantio" })),
  ...Object.values(CATEGORIAS_DO_CALENDARIO).map((t) => ({ hex: t.cor, significado: t.rotulo, onde: "Calendário" })),
  { hex: FUNDO.entrada, significado: "Entradas", onde: "Gráfico do Dashboard" },
  { hex: FUNDO.saida, significado: "Saídas", onde: "Gráfico do Dashboard" },
  { hex: ACENTO.entrada, significado: "Entrada", onde: "Relatório" },
  { hex: "#f87171", significado: "Excluir", onde: "Botão de perigo" },
];

// -------------------------------------------------------------- blocos

function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        {sub && <p className="text-sm text-slate-500 max-w-3xl">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Cartao({ titulo, children, className }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-4 space-y-3", className)}>
      {titulo && <p className="text-sm font-medium text-slate-800">{titulo}</p>}
      {children}
    </div>
  );
}

function Amostra({ cor, rotulo, sub }: { cor: string; rotulo?: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="size-5 shrink-0 rounded" style={{ background: cor }} title={cor} />
      {rotulo && (
        <span className="text-sm text-slate-700 truncate">
          {rotulo}
          {sub && <span className="text-slate-400"> · {sub}</span>}
        </span>
      )}
    </div>
  );
}

function Faixa({ cores, rotulo }: { cores: string[]; rotulo: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 text-sm text-slate-600">{rotulo}</span>
      <div className="flex gap-1">
        {cores.map((c, i) => (
          <span key={i} className="size-6 rounded" style={{ background: c }} title={c} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- gráficos

/** Barras verticais: marca fina, ponta arredondada de 4px, 2px entre barras. */
function Barras({ dados, cor }: { dados: { rotulo: string; valor: number }[]; cor: (i: number) => string }) {
  const max = Math.max(...dados.map((d) => d.valor));
  const H = 140;
  const L = 34;
  const G = 30;
  return (
    <svg viewBox={`0 0 ${dados.length * (L + G)} ${H + 34}`} className="w-full max-w-md h-auto">
      <line x1="0" x2={dados.length * (L + G)} y1={H} y2={H} stroke="var(--color-slate-300)" strokeWidth="1" />
      {dados.map((d, i) => {
        const h = (d.valor / max) * (H - 16);
        const x = i * (L + G) + G / 2;
        return (
          <g key={d.rotulo}>
            <path
              d={`M${x},${H} v${-(h - 4)} q0,-4 4,-4 h${L - 8} q4,0 4,4 v${h - 4} z`}
              fill={cor(i)}
            >
              <title>{`${d.rotulo}: R$ ${d.valor.toLocaleString("pt-BR")}`}</title>
            </path>
            <text x={x + L / 2} y={H + 14} textAnchor="middle" fontSize="10" fill="var(--color-slate-500)">
              {d.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Rosca com 2px de superfície entre as fatias. */
function Rosca({ dados, cor }: { dados: { rotulo: string; valor: number }[]; cor: (i: number) => string }) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let acum = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="size-36 shrink-0 -rotate-90">
        {dados.map((d, i) => {
          const frac = d.valor / total;
          const el = (
            <circle
              key={d.rotulo}
              cx="70" cy="70" r={R} fill="none" stroke={cor(i)} strokeWidth="22"
              strokeDasharray={`${Math.max(frac * C - 2, 0)} ${C}`}
              strokeDashoffset={-acum * C}
            >
              <title>{`${d.rotulo}: ${(frac * 100).toFixed(0)}%`}</title>
            </circle>
          );
          acum += frac;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5">
        {dados.map((d, i) => (
          <li key={d.rotulo} className="flex items-center gap-2 text-sm text-slate-700">
            <span className="size-3 rounded-sm" style={{ background: cor(i) }} />
            {d.rotulo}
            <span className="text-slate-400 tabular-nums">{((d.valor / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------ constantes

const ICONE_DO_STATUS: Record<PapelDeStatus, ComponentType<{ className?: string }>> = {
  sucesso: IconeSucesso,
  atencao: IconeAtencao,
  perigo: IconePerigo,
  info: IconeInfo,
};

/** Selo de categoria (fundo 200 / texto 900), em classes literais — o
 *  Tailwind só gera classe que aparece escrita inteira no código. */
const SELO_DA_CATEGORIA: Record<string, string> = {
  lime: "bg-lime-200 text-lime-900",
  blue: "bg-blue-200 text-blue-900",
  pink: "bg-pink-200 text-pink-900",
  violet: "bg-violet-200 text-violet-900",
  teal: "bg-teal-200 text-teal-900",
  orange: "bg-orange-200 text-orange-900",
  sky: "bg-sky-200 text-sky-900",
  amber: "bg-amber-200 text-amber-900",
};

const NEUTROS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const PAPEL_DO_NEUTRO: Partial<Record<(typeof NEUTROS)[number], string>> = {
  50: "fundo de página",
  100: "fundo de bloco",
  200: "borda · ativo",
  400: "texto apagado",
  500: "texto de apoio",
  600: "ícone · texto",
  800: "marca · botão",
  900: "título",
};

// ----------------------------------------------------------------- página

export default function PaletaPage() {
  const { tema, escolher } = useTema();
  const cat = (i: number) => corDaCategoria(i, tema);

  // Diagnóstico: famílias de cor usadas com mais de um significado.
  const porFamilia = new Map<string, UsoDeCor[]>();
  for (const u of USOS_HOJE) {
    const f = familia(u.hex);
    porFamilia.set(f, [...(porFamilia.get(f) ?? []), u]);
  }
  const sobrecarregadas = [...porFamilia.entries()]
    .filter(([, us]) => new Set(us.map((u) => u.onde)).size > 1)
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-10 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Paleta do app</h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Em cima, o que o app usa hoje, lido do próprio código. Embaixo, a proposta
            (<code className="text-xs">src/lib/paleta.ts</code>) aplicada em componentes de verdade.
          </p>
        </div>
        <div className="flex gap-1 rounded-md bg-slate-100 p-1">
          {(["claro", "escuro"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => escolher(t)}
              className={cn(
                "h-8 px-3 rounded text-sm capitalize",
                tema === t ? "bg-white text-slate-900 font-medium shadow-sm" : "text-slate-600",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* ============================================================ HOJE */}
      <Secao
        titulo="1. Hoje: onde está inconsistente"
        sub="Cada lista do domínio escolheu suas cores sozinha. O resultado: a mesma cor quer dizer coisas diferentes, o mesmo assunto aparece em cores diferentes, e cada gráfico usa um tom."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Cartao titulo="Mesma família de cor, vários significados">
            <div className="space-y-3">
              {sobrecarregadas.slice(0, 6).map(([f, us]) => (
                <div key={f} className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 capitalize">{f}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {us.map((u, i) => (
                      <Amostra key={i} cor={u.hex} rotulo={u.significado} sub={u.onde} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Cartao>

          <div className="space-y-3">
            <Cartao titulo="Mesmo assunto, cores diferentes">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-4">
                  <Amostra cor={TIPOS.planting.cor} rotulo="Plantio" sub="atividade" />
                  <Amostra cor={CATEGORIAS_DO_CALENDARIO.plantio.cor} rotulo="Plantio" sub="calendário" />
                </div>
                <div className="flex flex-wrap gap-4">
                  <Amostra cor={FUNDO.entrada} rotulo="Entrada" sub="dashboard" />
                  <Amostra cor={ACENTO.entrada} rotulo="Entrada" sub="relatório" />
                  <Amostra cor={CATEGORIAS_DO_CALENDARIO.receber.cor} rotulo="A receber" sub="calendário" />
                  <Amostra cor="#14b8a6" rotulo="Receita" sub="ícone em Configurações" />
                </div>
                <div className="flex flex-wrap gap-4">
                  <Amostra cor={FUNDO.saida} rotulo="Saída" sub="dashboard" />
                  <Amostra cor="#f87171" rotulo="Excluir" sub="botão" />
                  <Amostra cor={CATEGORIAS_DO_CALENDARIO.pagar.cor} rotulo="A pagar" sub="calendário" />
                </div>
              </div>
            </Cartao>

            <Cartao titulo="Cada gráfico num tom">
              <div className="space-y-2">
                <Faixa rotulo="Dashboard (300)" cores={[FUNDO.entrada, FUNDO.saida]} />
                <Faixa rotulo="Centros de custo (400)" cores={CC_COLORS} />
                <Faixa rotulo="Atividades (500)" cores={Object.values(TIPOS).map((t) => t.cor)} />
                <Faixa rotulo="Culturas no painel (600)" cores={CORES_DE_CULTURA} />
              </div>
            </Cartao>

            <Cartao titulo="Outros desvios">
              <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-4">
                <li>
                  <b className="font-medium text-slate-800">Vermelho fora de erro:</b> centro de custo pode ser
                  vermelho, ícone de "Categorias de Despesa" é vermelho, "Observação" é rosa-avermelhado.
                </li>
                <li>
                  <b className="font-medium text-slate-800">Cinza azulado antigo</b> (#64748b, #94a3b8) em
                  "Outros" de ensaio, finalidade e painel, fora da escala grafite.
                </li>
                <li>
                  <b className="font-medium text-slate-800">Texto de status em vários degraus:</b> vermelho 600
                  (37×) e 700 (35×); âmbar em 4 degraus (500 a 800).
                </li>
                <li>
                  <b className="font-medium text-slate-800">Selo com 20 cores</b> disponíveis, 8 usadas.
                </li>
                <li>
                  <b className="font-medium text-slate-800">Ícones de atalho</b> em Configurações e Cartões com
                  uma cor cada, sem significado.
                </li>
              </ul>
            </Cartao>
          </div>
        </div>
      </Secao>

      {/* ======================================================= PROPOSTA */}
      <Secao
        titulo="2. Proposta: quatro famílias, cada uma com um trabalho"
        sub="Marca, neutros, status e categorias. Cor só entra quando diz alguma coisa; o resto é grafite."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Cartao titulo="Marca">
            <div className="flex gap-3">
              <div className="flex-1 h-16 rounded-md flex items-end p-2 text-xs text-branco" style={{ background: MARCA.grafite }}>
                Grafite #3C3C42
              </div>
              <div className="flex-1 h-16 rounded-md flex items-end p-2 text-xs text-[#19191d]" style={{ background: MARCA.lima }}>
                Lima #B3FF34
              </div>
            </div>
            <p className="text-sm text-slate-500">
              O grafite é a cor dos botões e da marca. O lima é destaque raro (entrada, Cropware), nunca cor de dado.
            </p>
          </Cartao>

          <Cartao titulo="Neutros (escala grafite)">
            {/* O Tailwind só gera a variável de um tom usado em alguma classe;
                o 950 não é, então leva o hex de reserva (no escuro, o bloco
                TEMA ESCURO de app.css define todos). */}
            <div className="grid grid-cols-11 gap-1">
              {NEUTROS.map((n) => (
                <div key={n} className="space-y-1">
                  <div className="h-10 rounded border border-slate-200" style={{ background: `var(--color-slate-${n}${n === 950 ? ", #19191d" : ""})` }} />
                  <p className="text-[10px] text-center text-slate-500 tabular-nums">{n}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {Object.entries(PAPEL_DO_NEUTRO).map(([n, p]) => (
                <span key={n}>
                  <b className="font-medium text-slate-700">{n}</b> {p}
                </span>
              ))}
            </div>
          </Cartao>

          <Cartao titulo="Status (significado reservado)" className="lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(STATUS) as PapelDeStatus[]).map((p) => {
                const s = STATUS[p];
                const Icone = ICONE_DO_STATUS[p];
                return (
                  <div key={p} className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">{s.rotulo}</p>
                    <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", s.fundo, s.borda, s.texto)}>
                      <Icone className="size-4 shrink-0" />
                      Mensagem de {p === "atencao" ? "atenção" : p}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge colorScheme={s.selo}>{p === "sucesso" ? "Pago" : p === "atencao" ? "Vence Hoje" : p === "perigo" ? "Atrasado" : "Novo"}</Badge>
                      <span className={cn("text-sm font-medium tabular-nums", s.texto)}>
                        {p === "perigo" ? "− R$ 1.250,00" : p === "sucesso" ? "+ R$ 3.400,00" : "R$ 980,00"}
                      </span>
                      <span className={cn("size-2.5 rounded-full", s.solido)} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-slate-500">
              Um degrau por uso: texto 700, fundo 50, borda 200, sólido 400, selo 200/900. Vermelho é só erro,
              saída e excluir; verde é só sucesso e entrada. Sempre com ícone ou rótulo junto.
            </p>
          </Cartao>

          <Cartao titulo="Categorias (8 cores em ordem fixa)" className="lg:col-span-2">
            <div className="grid grid-cols-4 sm:grid-cols-9 gap-2">
              {CATEGORIAS.map((c, i) => (
                <div key={c.matiz} className="space-y-1">
                  <div className="h-12 rounded-md flex items-end p-1.5 text-[11px] text-branco font-medium" style={{ background: c[tema] }}>
                    {i + 1}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {c.matiz} {c.degrau[tema]}
                  </p>
                </div>
              ))}
              <div className="space-y-1">
                <div className="h-12 rounded-md flex items-end p-1.5 text-[11px] text-branco font-medium" style={{ background: OUTROS[tema] }}>
                  …
                </div>
                <p className="text-[11px] text-slate-500">outros</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map((c, i) => (
                <Badge key={c.matiz} colorScheme="none" className={SELO_DA_CATEGORIA[c.matiz]}>
                  {["Sementes", "Nutrição", "Biológicos", "Defensivos", "Fertilizantes", "Especialidades", "Irrigação", "Colheita"][i]}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              Para identidade: tipo, cultura, categoria. A ordem é o que garante que vizinhos se distinguem, inclusive
              para daltônicos (conferido no claro e no escuro). Lista com mais de 8 itens agrupa o resto em "Outros".
            </p>
          </Cartao>
        </div>
      </Secao>

      {/* ====================================================== NA PRÁTICA */}
      <Secao titulo="3. Na prática" sub="Os mesmos tokens em componentes. Passe o mouse nas barras e fatias.">
        <div className="grid gap-3 lg:grid-cols-2">
          <Cartao titulo="Custo por tipo de atividade (categorias 1–6)">
            <Barras
              cor={cat}
              dados={[
                { rotulo: "Aplicação", valor: 42000 },
                { rotulo: "Adubação", valor: 31000 },
                { rotulo: "Plantio", valor: 18000 },
                { rotulo: "Colheita", valor: 15500 },
                { rotulo: "Calagem", valor: 9000 },
                { rotulo: "Irrigação", valor: 6200 },
              ]}
            />
          </Cartao>

          <Cartao titulo="Área por cultura (3 cores + outros)">
            <Rosca
              cor={(i) => (i < 3 ? cat(i) : OUTROS[tema])}
              dados={[
                { rotulo: "Soja", valor: 520 },
                { rotulo: "Milho", valor: 310 },
                { rotulo: "Trigo", valor: 140 },
                { rotulo: "Outras", valor: 60 },
              ]}
            />
          </Cartao>

          <Cartao titulo="Entradas e saídas (status, não categoria)">
            <div className="flex items-end gap-6 h-36">
              {[
                ["Set", 38, 30],
                ["Out", 45, 41],
                ["Nov", 52, 36],
              ].map(([m, e, s]) => (
                <div key={m as string} className="flex flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 h-28">
                    <div className={cn("w-6 rounded-t", STATUS.sucesso.solido)} style={{ height: `${(e as number) * 2}px` }} title={`Entradas ${m}`} />
                    <div className={cn("w-6 rounded-t", STATUS.perigo.solido)} style={{ height: `${(s as number) * 2}px` }} title={`Saídas ${m}`} />
                  </div>
                  <span className="text-xs text-slate-500">{m}</span>
                </div>
              ))}
              <ul className="space-y-1.5 text-sm text-slate-700 pb-6">
                <li className="flex items-center gap-2"><span className={cn("size-3 rounded-sm", STATUS.sucesso.solido)} />Entradas</li>
                <li className="flex items-center gap-2"><span className={cn("size-3 rounded-sm", STATUS.perigo.solido)} />Saídas</li>
              </ul>
            </div>
          </Cartao>

          <Cartao titulo="Botões">
            <div className="flex flex-wrap gap-2">
              <Button><IconeMais />Novo Lançamento</Button>
              <Button variant="secondary">Cancelar</Button>
              <Button variant="outline">Exportar</Button>
              <Button variant="ghost">Ver Mais</Button>
              <Button variant="destructive"><IconeLixo />Excluir</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="h-9 px-4 rounded-md text-sm font-medium text-[#19191d] hover:brightness-95" style={{ background: MARCA.lima }}>
                Assinar o Pro
              </button>
              <span className="text-sm text-slate-500">← opção: destaque em lima, só para 1 ação rara (assinar, começar)</span>
            </div>
          </Cartao>

          <Cartao titulo="Ícones">
            <div className="flex flex-wrap items-center gap-4 text-slate-600">
              <IconePlanta className="size-5" />
              <IconeGrafico className="size-5" />
              <IconeCalendario className="size-5" />
              <IconeArquivo className="size-5" />
              <span className="text-sm text-slate-500">padrão: grafite, como no menu</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {(Object.keys(STATUS) as PapelDeStatus[]).map((p) => {
                const Icone = ICONE_DO_STATUS[p];
                return (
                  <span key={p} className={cn("flex items-center gap-1.5 text-sm", STATUS[p].texto)}>
                    <Icone className="size-4" />
                    {p === "sucesso" ? "Conciliado" : p === "atencao" ? "Vence amanhã" : p === "perigo" ? "Falhou" : "Dica"}
                  </span>
                );
              })}
            </div>
            <p className="text-sm text-slate-500">Ícone colorido só quando a cor é o status, e com texto junto.</p>
          </Cartao>
        </div>
      </Secao>
    </div>
  );
}

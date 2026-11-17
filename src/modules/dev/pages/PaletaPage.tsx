import { useState, type ComponentType, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useTema } from "@/lib/tema";
import {
  OPCOES_DE_CATEGORIAS,
  MARCA,
  OUTROS,
  STATUS,
  corDaCategoria,
  type PapelDeStatus,
} from "@/lib/paleta";
import { TIPOS } from "@/modules/field/dominio/atividades";
import { TIPOS_DE_ENSAIO } from "@/modules/field/dominio/ensaios";
import { FINALIDADES } from "@/modules/field/dominio/plantios";
import { CATEGORIAS as CATEGORIAS_DO_CALENDARIO } from "@/modules/calendario/itens";
import { CC_COLORS } from "@/modules/cost-centers/types";
import { ccTextColor } from "@/modules/cost-centers/ccIcons";
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
 * Referência da paleta do app (src/lib/paleta.ts), aprovada em 17/11/2026.
 * A seção "Onde aparece" lê as PRÓPRIAS listas do domínio (importadas, não
 * copiadas): se alguém mudar uma cor lá, a página mostra. O diagnóstico do
 * "antes" (cada lista com suas cores) está no histórico: commit ef920d4.
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
  return {
    L,
    C: Math.hypot(a, bb),
    H: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360,
  };
}

// -------------------------------------------------------------- blocos

function Secao({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: string;
  children: ReactNode;
}) {
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

function Cartao({
  titulo,
  children,
  className,
}: {
  titulo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4 space-y-3",
        className,
      )}
    >
      {titulo && <p className="text-sm font-medium text-slate-800">{titulo}</p>}
      {children}
    </div>
  );
}

function Amostra({
  cor,
  rotulo,
  sub,
}: {
  cor: string;
  rotulo?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="size-5 shrink-0 rounded"
        style={{ background: cor }}
        title={cor}
      />
      {rotulo && (
        <span className="text-sm text-slate-700 truncate">
          {rotulo}
          {sub && <span className="text-slate-400"> · {sub}</span>}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------- gráficos

/** Barras verticais: marca fina, ponta arredondada de 4px, 2px entre barras. */
function Barras({
  dados,
  cor,
}: {
  dados: { rotulo: string; valor: number }[];
  cor: (i: number) => string;
}) {
  const max = Math.max(...dados.map((d) => d.valor));
  const H = 140;
  const L = 34;
  const G = 30;
  return (
    <svg
      viewBox={`0 0 ${dados.length * (L + G)} ${H + 34}`}
      className="w-full max-w-md h-auto"
    >
      <line
        x1="0"
        x2={dados.length * (L + G)}
        y1={H}
        y2={H}
        stroke="var(--color-slate-300)"
        strokeWidth="1"
      />
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
            <text
              x={x + L / 2}
              y={H + 14}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-slate-500)"
            >
              {d.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Rosca com 2px de superfície entre as fatias. */
function Rosca({
  dados,
  cor,
}: {
  dados: { rotulo: string; valor: number }[];
  cor: (i: number) => string;
}) {
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
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={cor(i)}
              strokeWidth="22"
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
          <li
            key={d.rotulo}
            className="flex items-center gap-2 text-sm text-slate-700"
          >
            <span
              className="size-3 rounded-sm"
              style={{ background: cor(i) }}
            />
            {d.rotulo}
            <span className="text-slate-400 tabular-nums">
              {((d.valor / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListaDeCores({ itens }: { itens: [string, string][] }) {
  return (
    <ul className="space-y-1.5">
      {itens.map(([rotulo, cor]) => (
        <li key={rotulo}>
          <Amostra cor={cor} rotulo={rotulo} />
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------ constantes

const ICONE_DO_STATUS: Record<
  PapelDeStatus,
  ComponentType<{ className?: string }>
> = {
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
  const [opcaoId, setOpcaoId] = useState(OPCOES_DE_CATEGORIAS[0].id);
  const opcao =
    OPCOES_DE_CATEGORIAS.find((o) => o.id === opcaoId) ??
    OPCOES_DE_CATEGORIAS[0];
  const lista = opcao.cores;
  const cat = (i: number) => corDaCategoria(i, tema, lista);
  /** Número dentro da amostra: escuro em cor clara, branco em cor escura. */
  const tinta = (hex: string) =>
    oklch(hex).L > 0.68 ? "text-[#19191d]/70" : "text-branco";

  return (
    <div className="space-y-10 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">
            Paleta do app
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            A paleta do app, aprovada em 17/11/2026 e aplicada nas telas. Fonte
            única: <code className="text-xs">src/lib/paleta.ts</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-md bg-slate-100 p-1">
            {(["claro", "escuro"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => escolher(t)}
                className={cn(
                  "h-8 px-3 rounded text-sm capitalize",
                  tema === t
                    ? "bg-white text-slate-900 font-medium shadow-sm"
                    : "text-slate-600",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ======================================================= PROPOSTA */}
      <Secao
        titulo="1. Quatro famílias, cada uma com um trabalho"
        sub="Marca, neutros, status e categorias. Cor só entra quando diz alguma coisa; o resto é grafite."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Cartao titulo="Marca">
            <div className="flex gap-3">
              <div
                className="flex-1 h-16 rounded-md flex items-end p-2 text-xs text-branco"
                style={{ background: MARCA.grafite }}
              >
                Grafite #3C3C42
              </div>
              <div
                className="flex-1 h-16 rounded-md flex items-end p-2 text-xs text-[#19191d]"
                style={{ background: MARCA.lima }}
              >
                Lima #B3FF34
              </div>
            </div>
            <p className="text-sm text-slate-500">
              O grafite é a cor dos botões e da marca. O lima é destaque raro
              (entrada, Cropware), nunca cor de dado.
            </p>
          </Cartao>

          <Cartao titulo="Neutros (escala grafite)">
            {/* O Tailwind só gera a variável de um tom usado em alguma classe;
                o 950 não é, então leva o hex de reserva (no escuro, o bloco
                TEMA ESCURO de app.css define todos). */}
            <div className="grid grid-cols-11 gap-1">
              {NEUTROS.map((n) => (
                <div key={n} className="space-y-1">
                  <div
                    className="h-10 rounded border border-slate-200"
                    style={{
                      background: `var(--color-slate-${n}${n === 950 ? ", #19191d" : ""})`,
                    }}
                  />
                  <p className="text-[10px] text-center text-slate-500 tabular-nums">
                    {n}
                  </p>
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

          <Cartao
            titulo="Status (significado reservado)"
            className="lg:col-span-2"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(STATUS) as PapelDeStatus[]).map((p) => {
                const s = STATUS[p];
                const Icone = ICONE_DO_STATUS[p];
                return (
                  <div key={p} className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">
                      {s.rotulo}
                    </p>
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                        s.fundo,
                        s.borda,
                        s.texto,
                      )}
                    >
                      <Icone className="size-4 shrink-0" />
                      Mensagem de {p === "atencao" ? "atenção" : p}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge colorScheme={s.selo}>
                        {p === "sucesso"
                          ? "Pago"
                          : p === "atencao"
                            ? "Vence Hoje"
                            : p === "perigo"
                              ? "Atrasado"
                              : "Novo"}
                      </Badge>
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          s.texto,
                        )}
                      >
                        {p === "perigo"
                          ? "− R$ 1.250,00"
                          : p === "sucesso"
                            ? "+ R$ 3.400,00"
                            : "R$ 980,00"}
                      </span>
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: s.solido[tema] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-slate-500">
              Um degrau por uso: texto 700, fundo 50, borda 200, sólido em
              pastel, selo 200/900. Vermelho é só erro, saída e excluir; verde é
              só sucesso e entrada. Sempre com ícone ou rótulo junto.
            </p>
          </Cartao>

          <Cartao
            titulo="Categorias (8 cores em ordem fixa)"
            className="lg:col-span-2"
          >
            <div className="flex flex-wrap gap-1 rounded-md bg-slate-100 p-1 w-fit">
              {OPCOES_DE_CATEGORIAS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOpcaoId(o.id)}
                  className={cn(
                    "h-8 px-3 rounded text-sm",
                    o.id === opcao.id
                      ? "bg-white text-slate-900 font-medium shadow-sm"
                      : "text-slate-600",
                  )}
                >
                  {o.nome}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              <b className="font-medium text-slate-700">{opcao.nome}:</b>{" "}
              {opcao.descricao} Distinção entre vizinhas {opcao.distincao}{" "}
              (daltonismo / visão normal; alvo 8 / 15). Contraste mínimo no
              branco {opcao.contrasteMinimo}.
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-9 gap-2">
              {lista.map((c, i) => (
                <div key={c.matiz} className="space-y-1">
                  <div
                    className={cn(
                      "h-12 rounded-md flex items-end p-1.5 text-[11px] font-medium",
                      tinta(c[tema]),
                    )}
                    style={{ background: c[tema] }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {c.matiz} <span className="text-slate-400">{c[tema]}</span>
                  </p>
                </div>
              ))}
              <div className="space-y-1">
                <div
                  className="h-12 rounded-md flex items-end p-1.5 text-[11px] text-branco font-medium"
                  style={{ background: OUTROS[tema] }}
                >
                  …
                </div>
                <p className="text-[11px] text-slate-500">outros</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lista.map((c, i) => (
                <Badge
                  key={c.matiz}
                  colorScheme="none"
                  className={SELO_DA_CATEGORIA[c.matiz]}
                >
                  {
                    [
                      "Sementes",
                      "Nutrição",
                      "Biológicos",
                      "Defensivos",
                      "Fertilizantes",
                      "Especialidades",
                      "Irrigação",
                      "Colheita",
                    ][i]
                  }
                </Badge>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              Para identidade: tipo, cultura, categoria. A ordem é o que garante
              que vizinhos se distinguem, inclusive para daltônicos (conferido
              no claro e no escuro). Lista com mais de 8 itens agrupa o resto em
              "Outros". Abaixo de 3:1 no branco, o gráfico leva sempre legenda e
              valor escrito.
            </p>
          </Cartao>

          <Cartao
            titulo="Todas as opções lado a lado"
            className="lg:col-span-2"
          >
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {OPCOES_DE_CATEGORIAS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOpcaoId(o.id)}
                  className={cn(
                    "text-left rounded-md p-2 -m-2 space-y-2 transition-colors",
                    o.id === opcao.id ? "bg-slate-100" : "hover:bg-slate-50",
                  )}
                >
                  <p className="text-sm font-medium text-slate-800">
                    {o.nome}
                    <span className="font-normal text-slate-400">
                      {" "}
                      · {o.distincao} · contraste {o.contrasteMinimo}
                    </span>
                  </p>
                  <div className="flex gap-1">
                    {o.cores.map((c) => (
                      <span
                        key={c.matiz}
                        className="h-7 flex-1 rounded"
                        style={{ background: c[tema] }}
                        title={c[tema]}
                      />
                    ))}
                  </div>
                  <div className="flex items-end gap-1 h-14">
                    {[90, 70, 52, 44, 34, 26, 18, 12].map((v, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-t"
                        style={{
                          height: `${v}%`,
                          background: o.cores[i][tema],
                        }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </Cartao>
        </div>
      </Secao>

      {/* ====================================================== NA PRÁTICA */}
      <Secao
        titulo="2. Na prática"
        sub="Os mesmos tokens em componentes. Passe o mouse nas barras e fatias."
      >
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
                <div
                  key={m as string}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex items-end gap-0.5 h-28">
                    <div
                      className="w-6 rounded-t"
                      style={{
                        height: `${(e as number) * 2}px`,
                        background: STATUS.sucesso.solido[tema],
                      }}
                      title={`Entradas ${m}`}
                    />
                    <div
                      className="w-6 rounded-t"
                      style={{
                        height: `${(s as number) * 2}px`,
                        background: STATUS.perigo.solido[tema],
                      }}
                      title={`Saídas ${m}`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{m}</span>
                </div>
              ))}
              <ul className="space-y-1.5 text-sm text-slate-700 pb-6">
                <li className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-sm"
                    style={{ background: STATUS.sucesso.solido[tema] }}
                  />
                  Entradas
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-sm"
                    style={{ background: STATUS.perigo.solido[tema] }}
                  />
                  Saídas
                </li>
              </ul>
            </div>
          </Cartao>

          <Cartao titulo="Botões">
            <div className="flex flex-wrap gap-2">
              <Button>
                <IconeMais />
                Novo Lançamento
              </Button>
              <Button variant="secondary">Cancelar</Button>
              <Button variant="outline">Exportar</Button>
              <Button variant="ghost">Ver Mais</Button>
              <Button variant="destructive">
                <IconeLixo />
                Excluir
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="h-9 px-4 rounded-md text-sm font-medium text-[#19191d] hover:brightness-95"
                style={{ background: MARCA.lima }}
              >
                Assinar o Pro
              </button>
              <span className="text-sm text-slate-500">
                ← opção: destaque em lima, só para 1 ação rara (assinar,
                começar)
              </span>
            </div>
          </Cartao>

          <Cartao titulo="Ícones">
            <div className="flex flex-wrap items-center gap-4 text-slate-600">
              <IconePlanta className="size-5" />
              <IconeGrafico className="size-5" />
              <IconeCalendario className="size-5" />
              <IconeArquivo className="size-5" />
              <span className="text-sm text-slate-500">
                padrão: grafite, como no menu
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {(Object.keys(STATUS) as PapelDeStatus[]).map((p) => {
                const Icone = ICONE_DO_STATUS[p];
                return (
                  <span
                    key={p}
                    className={cn(
                      "flex items-center gap-1.5 text-sm",
                      STATUS[p].texto,
                    )}
                  >
                    <Icone className="size-4" />
                    {p === "sucesso"
                      ? "Conciliado"
                      : p === "atencao"
                        ? "Vence amanhã"
                        : p === "perigo"
                          ? "Falhou"
                          : "Dica"}
                  </span>
                );
              })}
            </div>
            <p className="text-sm text-slate-500">
              Ícone colorido só quando a cor é o status, e com texto junto.
            </p>
          </Cartao>
        </div>
      </Secao>

      {/* ===================================================== ONDE APARECE */}
      <Secao
        titulo="3. Onde aparece"
        sub="As listas do domínio, lidas do código. Quem diz o item é o rótulo; a cor ajuda a achar."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <Cartao titulo="Atividades (cor por família)">
            <ListaDeCores
              itens={Object.values(TIPOS).map((t) => [t.rotulo, t.cor])}
            />
          </Cartao>
          <Cartao titulo="Calendário">
            <ListaDeCores
              itens={Object.values(CATEGORIAS_DO_CALENDARIO).map((t) => [
                t.rotulo,
                t.cor,
              ])}
            />
          </Cartao>
          <div className="space-y-3">
            <Cartao titulo="Tipos de ensaio">
              <ListaDeCores
                itens={Object.values(TIPOS_DE_ENSAIO).map((t) => [
                  t.rotulo,
                  t.cor,
                ])}
              />
            </Cartao>
            <Cartao titulo="Finalidade do plantio">
              <ListaDeCores
                itens={Object.values(FINALIDADES).map((t) => [t.rotulo, t.cor])}
              />
            </Cartao>
          </div>
          <Cartao
            titulo="Centros de custo (cores que a pessoa escolhe)"
            className="lg:col-span-3"
          >
            <div className="flex flex-wrap gap-3">
              {CC_COLORS.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-2 rounded-md px-2.5 h-8 text-sm font-medium"
                  style={{ background: c, color: ccTextColor(c) }}
                >
                  Centro
                </span>
              ))}
            </div>
          </Cartao>
        </div>
      </Secao>
    </div>
  );
}

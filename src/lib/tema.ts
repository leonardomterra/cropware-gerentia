import { useEffect, useState } from "react";
import { isNativeCapacitorApp } from "@/utils/platform";

/**
 * Tema claro/escuro (17/11/2026).
 *
 * A preferência é do APARELHO (localStorage), não da conta: cada um escolhe no
 * seu celular/computador, como em qualquer app. O padrão é "sistema" — segue o
 * claro/escuro do sistema operacional e troca junto quando ele troca.
 *
 * Aplicar = pôr ou tirar a classe `.dark` no <html>; o resto é CSS (app.css,
 * bloco TEMA ESCURO). O index.html repete a leitura num script inline, antes
 * do React, para a primeira pintura já sair no tema certo (sem piscar branco).
 */
export type PreferenciaDeTema = "claro" | "escuro" | "sistema";
export type Tema = "claro" | "escuro";

const CHAVE = "gerentia.tema";
const consultaEscuro = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function lerPreferencia(): PreferenciaDeTema {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "claro" || v === "escuro" || v === "sistema") return v;
  } catch {
    /* sem storage: segue o sistema */
  }
  return "sistema";
}

export function temaDe(p: PreferenciaDeTema): Tema {
  if (p !== "sistema") return p;
  return consultaEscuro()?.matches ? "escuro" : "claro";
}

export function temaAtual(): Tema {
  return document.documentElement.classList.contains("dark")
    ? "escuro"
    : "claro";
}

// ---- Barra de status (app nativo) e cor do navegador ---------------------

/** "superficie" = tela de entrada/paywall (fundo branco); "cabecalho" = app
 *  logado (cabeçalho do celular, slate-100). */
export type FundoDaBarra = "superficie" | "cabecalho";
const CORES_DA_BARRA: Record<Tema, Record<FundoDaBarra, string>> = {
  claro: { superficie: "#ffffff", cabecalho: "#f1f1f3" },
  escuro: { superficie: "#1d1d21", cabecalho: "#26262b" },
};
let fundoDaBarra: FundoDaBarra = "superficie";

function pintarBarra() {
  const tema = temaAtual();
  const cor = CORES_DA_BARRA[tema][fundoDaBarra];
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", cor);
  if (!isNativeCapacitorApp()) return;
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => {
      StatusBar.setBackgroundColor({ color: cor }).catch(() => {});
      // Style.Light = ícones escuros (fundo claro); Style.Dark = ícones claros.
      StatusBar.setStyle({
        style: tema === "escuro" ? Style.Dark : Style.Light,
      }).catch(() => {});
    })
    .catch(() => {});
}

/** Pinta a barra de status para o fundo da tela atual, no tema atual. */
export function pintarBarraDeStatus(fundo: FundoDaBarra) {
  fundoDaBarra = fundo;
  pintarBarra();
}

// ---- Aplicar e reagir ------------------------------------------------------

const ouvintes = new Set<() => void>();

function aplicar() {
  const escuro = temaDe(lerPreferencia()) === "escuro";
  document.documentElement.classList.toggle("dark", escuro);
  pintarBarra();
  ouvintes.forEach((f) => f());
}

export function salvarPreferencia(p: PreferenciaDeTema) {
  try {
    localStorage.setItem(CHAVE, p);
  } catch {
    /* sem storage: vale só nesta sessão */
  }
  aplicar();
}

let iniciado = false;
/** Chamado uma vez no main.tsx. Segue o sistema quando a preferência é essa. */
export function iniciarTema() {
  if (iniciado) return;
  iniciado = true;
  aplicar();
  consultaEscuro()?.addEventListener("change", () => {
    if (lerPreferencia() === "sistema") aplicar();
  });
}

/** Preferência + tema em uso, atualizados quando qualquer um muda. */
export function useTema(): {
  preferencia: PreferenciaDeTema;
  tema: Tema;
  escolher: (p: PreferenciaDeTema) => void;
} {
  const [, setVersao] = useState(0);
  useEffect(() => {
    const f = () => setVersao((v) => v + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  return {
    preferencia: lerPreferencia(),
    tema: temaAtual(),
    escolher: salvarPreferencia,
  };
}

// ---- Cores concretas, para quem não lê variável CSS ------------------------

/**
 * A escala grafite em hex, nos dois temas — espelha app.css (claro: @theme;
 * escuro: bloco TEMA ESCURO, scripts/gerar-tema-escuro.py). Para atributos de
 * SVG/gráfico (`stroke`, `fill` do recharts), onde var(--…) não é garantido.
 * Em `style`/className, preferir as variáveis — elas trocam sozinhas.
 */
const ESCALA: Record<
  Tema,
  Record<"white" | 100 | 200 | 400 | 500 | 800 | 900, string>
> = {
  claro: {
    white: "#ffffff",
    100: "#f1f1f3",
    200: "#e2e2e6",
    400: "#a1a1a7",
    500: "#7c7c83",
    800: "#3c3c42",
    900: "#2b2b30",
  },
  escuro: {
    white: "#1d1d21",
    100: "#26262b",
    200: "#33333a",
    400: "#6a6a72",
    500: "#9a9aa2",
    800: "#e2e2e6",
    900: "#eeeef1",
  },
};

export function useCoresDoTema() {
  return ESCALA[useTema().tema];
}

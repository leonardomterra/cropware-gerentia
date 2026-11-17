import { useEffect, useState } from "react";

/**
 * Quando a marca anima na tela de entrada (AuthLayout + LogoAnimado.tsx).
 *
 * Mesmo critério do site da Cropware (cropware-site, BaseLayout): a abertura
 * completa — reflexo, mexidinha e o nome digitando — só toca numa **visita
 * nova**, 30 min sem abrir a tela de entrada. F5, ou ir do login para "criar
 * conta" e voltar, não repete. Enquanto a tela fica aberta, o reflexo e a
 * mexidinha voltam sozinhos a cada PULSO_MS (o nome não redigita).
 *
 * Quem pede movimento reduzido no sistema vê a marca parada.
 */
const CHAVE = "gerentia.ultimaVisitaEntrada";
const NOVA_VISITA_MS = 30 * 60_000;
const PULSO_MS = 20_000;

export function reduzMovimento(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function ultimaVisita(): number {
  try {
    return Number(localStorage.getItem(CHAVE)) || 0;
  } catch {
    return 0;
  }
}

/**
 * `abertura`: tocar a entrada completa agora (decidido uma vez por montagem).
 * `pulso`: conta os repiques do reflexo; muda a cada PULSO_MS com a aba visível.
 */
export function useAberturaDaMarca(): { abertura: boolean; pulso: number } {
  // Lê no inicializador e grava no efeito: no StrictMode o inicializador roda
  // duas vezes, e as duas leituras acontecem antes da gravação.
  const [abertura] = useState(
    () => !reduzMovimento() && Date.now() - ultimaVisita() > NOVA_VISITA_MS,
  );
  const [pulso, setPulso] = useState(0);

  useEffect(() => {
    const marcar = () => {
      try {
        localStorage.setItem(CHAVE, String(Date.now()));
      } catch {
        /* sem storage: toca sempre, sem problema */
      }
    };
    marcar();
    if (reduzMovimento()) return marcar;
    const id = window.setInterval(() => {
      if (!document.hidden) setPulso((p) => p + 1);
    }, PULSO_MS);
    return () => {
      window.clearInterval(id);
      marcar();
    };
  }, []);

  return { abertura, pulso };
}

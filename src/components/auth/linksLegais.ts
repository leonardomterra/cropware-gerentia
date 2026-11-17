/**
 * Endereços legais e de ajuda mostrados nas telas de entrada (AuthLayout e
 * cadastro). Absolutos de propósito: no app nativo o link sai para o
 * navegador, então "/privacidade.html" relativo não serviria.
 *
 * - Privacidade: a do gerentia (public/privacidade.html), a mesma da
 *   assinatura (SubscriptionCard).
 * - Termos e ajuda: os do site da Cropware (valem para os apps da Cropware).
 */
export const LINKS_LEGAIS = {
  termos: "https://cropware.com.br/termos",
  privacidade: "https://gerentia.app/privacidade.html",
  ajuda: "https://cropware.com.br/ajuda",
} as const;

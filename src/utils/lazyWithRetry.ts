import { lazy, type ComponentType } from "react";

/**
 * Wrapper de `React.lazy` que tenta importar chunks duas vezes antes de
 * desistir. Util quando o app foi deployado e o user esta com a tab aberta
 * de uma versao anterior - os chunks novos podem nao existir mais e o lazy
 * load joga ChunkLoadError.
 *
 * Em caso de falha, faz um hard reload assumindo que o ServiceWorker / cache
 * vai puxar a versao nova.
 */
// `ComponentType<any>` e nao `<unknown>`: com unknown, so aceita componente sem
// props — e telas que recebem props (ex.: AdminOrgsPage com `aoSair`) deixavam
// de caber aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch {
      // Segunda tentativa - cobre flakes transientes de rede
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return await factory();
      } catch (retryErr) {
        // Se mesmo a segunda falhou, recarrega a pagina pra pegar bundle novo
        console.error("[lazyWithRetry] chunk load failed twice:", retryErr);
        if (typeof window !== "undefined") {
          window.location.reload();
        }
        throw retryErr;
      }
    }
  });
}

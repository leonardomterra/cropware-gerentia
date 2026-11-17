import { useOutletContext } from "react-router-dom";
import type { ModuloId } from "@/lib/modulos";

/** O que o AppShell entrega às páginas pelo `<Outlet context>`. */
export interface ContextoDoShell {
  moduloAtivo: ModuloId;
}

/**
 * Módulo ativo no menu (o do selo no topo). Para telas FIXAS que mudam de
 * conteúdo conforme o módulo — o Dashboard, desde 17/11/2026. Fora do shell
 * (sem contexto), vale o Finanças.
 */
export function useModuloAtivo(): ModuloId {
  const c = useOutletContext<ContextoDoShell | undefined>();
  return c?.moduloAtivo ?? "financas";
}

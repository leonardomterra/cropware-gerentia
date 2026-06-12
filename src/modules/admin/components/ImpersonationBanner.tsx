import { useEffect, useState } from "react";
import {
  getImpersonationState,
  stopImpersonation,
  type ImpersonationState,
} from "@/utils/impersonate";

/**
 * Barra fixa de aviso enquanto o master está impersonando outro usuário.
 * Lê o estado do appStorage; "Voltar" restaura a sessão do master.
 */
export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null);

  useEffect(() => {
    void getImpersonationState().then(setState);
  }, []);

  if (!state) return null;

  return (
    <div className="bg-amber-500 text-white text-sm px-4 py-2 flex items-center justify-center gap-3 shrink-0">
      <span>
        Visualizando como{" "}
        <strong>{state.targetName || state.targetEmail}</strong>
      </span>
      <button
        type="button"
        onClick={() => void stopImpersonation()}
        className="underline font-medium hover:no-underline"
      >
        Voltar pra minha conta
      </button>
    </div>
  );
}

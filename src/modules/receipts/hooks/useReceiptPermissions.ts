import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Receipt } from "../types";

/**
 * Quem pode editar/apagar CADA lançamento.
 *
 * O gestor enxerga a equipe inteira mas só mexe no que é dele
 * (docs/ORGANIZACOES-E-PERFIS.md §2). Sem esta checagem por linha, o botão
 * "Editar" aparecia no lançamento do colega e a RLS derrubava só na hora de
 * salvar — um erro que não explica nada pra quem clicou.
 *
 * `canWriteOthers` é o mesmo interruptor de `farm_can_write_others()` no banco:
 * o dia que o gestor puder editar tudo, a UI acompanha sozinha.
 */
export function useReceiptPermissions() {
  const { user, canWrite } = useAuth();
  const canWriteOthers = user?.permissions.canWriteOthers ?? false;

  const canEdit = useCallback(
    (r: Pick<Receipt, "created_by">) =>
      canWrite && (canWriteOthers || r.created_by === user?.id),
    [canWrite, canWriteOthers, user?.id],
  );

  return { canEdit };
}

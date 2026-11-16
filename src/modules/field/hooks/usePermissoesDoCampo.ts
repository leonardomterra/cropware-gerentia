import { useAuth } from "@/contexts/AuthContext";
import { modulosComDireito } from "@/lib/modulos";
import { mostraProdutores } from "@/utils/modoDeUso";

/**
 * O que a pessoa pode fazer nos cadastros do Field. Espelha a RLS
 * (20261118120000_field_cadastros.sql) para a tela não oferecer o que o banco
 * vai recusar:
 *   - criar: pode escrever (não é convidado) e a org tem o módulo Field;
 *   - editar/excluir: além disso, só o que ela mesma cadastrou.
 */
export function usePermissoesDoCampo() {
  const { user, canWrite } = useAuth();
  const temModulo = modulosComDireito(user?.modules).includes("field");
  const podeCriar = canWrite && temModulo;
  return {
    podeCriar,
    podeMexer: (item: { created_by: string | null }) =>
      podeCriar && !!user && item.created_by === user.id,
    comProdutores: mostraProdutores(user?.fieldMode),
  };
}

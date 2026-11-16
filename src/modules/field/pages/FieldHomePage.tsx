import Plant from "~icons/ph/plant-duotone";
import { useAuth } from "@/contexts/AuthContext";
import { mostraProdutores, rotuloDoModo } from "@/utils/modoDeUso";

/**
 * Página inicial do módulo Field — PROVISÓRIA (fase 0 da unificação, ver
 * docs/UNIFICACAO-FIELD.md). Existe para exercitar o seletor de módulos de
 * ponta a ponta; as telas de verdade (fazendas, talhões, plantios…) chegam na
 * fase 1. Só o master a vê enquanto FIELD_LIBERADO for false.
 */
export default function FieldHomePage() {
  const { user } = useAuth();
  const modo = user?.fieldMode ?? null;

  return (
    <div className="mx-auto max-w-lg py-10 space-y-4">
      <div className="size-12 rounded-xl bg-lime-100 flex items-center justify-center">
        <Plant className="size-7 text-lime-700" />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">
        Field — em construção
      </h1>
      <p className="text-sm text-slate-600">
        Aqui vão ficar fazendas, talhões, plantios, atividades e ensaios.
      </p>
      <p className="text-sm text-slate-500">
        Modo de uso: <span className="font-medium">{rotuloDoModo(modo)}</span>
        {" · "}
        nível Produtores {mostraProdutores(modo) ? "visível" : "escondido"}.
      </p>
    </div>
  );
}

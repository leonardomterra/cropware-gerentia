import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/components/ui/utils";
import { MODOS_DE_USO, type ModoDeUso } from "@/utils/modoDeUso";

/**
 * "Como você vai usar o Field?" — as duas opções de `users_meta.field_mode`,
 * como cartões clicáveis. O mesmo campo no cadastro, na Conta e no painel do
 * master (ver utils/modoDeUso.ts).
 */
export function CampoModoDeUso({
  valor,
  onChange,
  disabled,
  idPrefixo = "modo-de-uso",
  titulo = "Como você vai usar o Field?",
}: {
  valor: ModoDeUso | null;
  onChange: (v: ModoDeUso) => void;
  disabled?: boolean;
  /** Prefixo dos ids — o mesmo campo pode aparecer duas vezes na tela. */
  idPrefixo?: string;
  titulo?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700 mb-1.5">
        {titulo}
      </legend>
      <RadioGroup
        value={valor ?? ""}
        onValueChange={(v) => onChange(v as ModoDeUso)}
        className="grid gap-2"
      >
        {MODOS_DE_USO.map((m) => {
          const id = `${idPrefixo}-${m.valor}`;
          return (
            <Label
              key={m.valor}
              htmlFor={id}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer leading-normal transition-colors",
                valor === m.valor
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <RadioGroupItem id={id} value={m.valor} className="mt-0.5" />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-slate-900">
                  {m.rotulo}
                </span>
                <span className="text-xs font-normal text-slate-500">
                  {m.detalhe}
                </span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

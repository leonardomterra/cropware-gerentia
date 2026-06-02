import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";

interface AiSuggestButtonProps {
  onClick: () => void;
  /** IA está processando (sparkle pulsa em loop + estado "pensando"). */
  loading: boolean;
  /** Bloqueia o botão (ex: campos obrigatórios ainda não preenchidos). */
  disabled?: boolean;
  /** Tooltip exibido quando o botão está bloqueado por falta de dados. */
  disabledHint?: string;
  /** Tooltip exibido quando o botão está disponível. */
  hint?: string;
  /** Texto do botão em repouso (default: "Sugerir"). */
  label?: string;
}

/**
 * Botão oficial de IA do produto (nosso diferencial): tag verde neon em
 * Space Mono CAIXA ALTA (exceção de marca, via textTransform inline pra
 * escapar do guard global .uppercase), com glow. Ícone = sparkle preenchido
 * (auto-awesome), parado em repouso e pulsando enquanto pensa. Bloqueado
 * fica neutro e o tooltip explica o porquê.
 */
export function AiSuggestButton({
  onClick,
  loading,
  disabled = false,
  disabledHint = "Preencha fornecedor e descrição para sugerir",
  hint = "Sugerir categoria com IA",
  label = "Sugerir",
}: AiSuggestButtonProps) {
  // "blocked" = indisponível por falta de dados (não conta o loading).
  const blocked = disabled && !loading;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            style={{
              fontFamily: '"Space Mono", ui-monospace, monospace',
              textTransform: "uppercase",
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 min-h-[1.125rem]",
              "text-[11px] font-normal leading-none tracking-wide",
              "transition-[filter,background-color,color] duration-200 ease-out",
              "disabled:pointer-events-none",
              blocked
                ? "bg-slate-100 text-slate-400"
                : "bg-[#caff33] text-[#1a2e05] shadow-[0_0_12px_-2px_rgba(190,242,100,0.9)] hover:brightness-105",
            )}
          >
            <span
              key={loading ? "thinking" : "idle"}
              className="inline-block min-w-[8.5ch] text-center animate-in fade-in duration-300"
            >
              {loading ? "Pensando" : label}
            </span>
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{blocked ? disabledHint : hint}</TooltipContent>
    </Tooltip>
  );
}

import Check from "~icons/ph/check-bold";
import Desktop from "~icons/ph/desktop";
import Moon from "~icons/ph/moon";
import Sun from "~icons/ph/sun";
import { cn } from "@/components/ui/utils";
import { useTema, type PreferenciaDeTema } from "@/lib/tema";

/**
 * Escolha do tema (Conta > Aparência). Vale para ESTE aparelho — fica no
 * navegador/celular, não na conta (lib/tema.ts). Cada opção mostra uma
 * miniatura da tela no tema dela, para a escolha não depender de imaginar.
 */
const OPCOES: {
  id: PreferenciaDeTema;
  titulo: string;
  descricao: string;
  Icon: typeof Sun;
}[] = [
  { id: "claro", titulo: "Claro", descricao: "Fundo branco", Icon: Sun },
  { id: "escuro", titulo: "Escuro", descricao: "Fundo grafite", Icon: Moon },
  {
    id: "sistema",
    titulo: "Igual ao Sistema",
    descricao: "Segue o claro/escuro do aparelho",
    Icon: Desktop,
  },
];

/** Miniatura de uma tela (menu + cartões) com cores fixas de cada tema. */
function Miniatura({ escuro }: { escuro: boolean }) {
  const c = escuro
    ? {
        fundo: "#141417",
        menu: "#1d1d21",
        cartao: "#1d1d21",
        linha: "#45454c",
        botao: "#e2e2e6",
      }
    : {
        fundo: "#f7f7f9",
        menu: "#ffffff",
        cartao: "#ffffff",
        linha: "#cacacf",
        botao: "#3c3c42",
      };
  return (
    <span
      aria-hidden
      className="flex h-full w-full overflow-hidden"
      style={{ background: c.fundo }}
    >
      <span
        className="w-1/4 h-full p-1.5 space-y-1"
        style={{ background: c.menu }}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="block h-1 rounded-full"
            style={{ background: c.linha }}
          />
        ))}
      </span>
      <span className="flex-1 p-2 space-y-1.5">
        <span className="block h-4 rounded" style={{ background: c.cartao }} />
        <span className="block h-4 rounded" style={{ background: c.cartao }} />
        <span
          className="block h-1.5 w-1/3 rounded-full"
          style={{ background: c.botao }}
        />
      </span>
    </span>
  );
}

export function AparenciaCard() {
  const { preferencia, escolher } = useTema();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <p className="text-sm text-slate-500">
        Vale para este aparelho. Em outro celular ou computador, escolha lá
        também.
      </p>
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        role="radiogroup"
        aria-label="Tema"
      >
        {OPCOES.map((o) => {
          const ativo = preferencia === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => escolher(o.id)}
              className={cn(
                "text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400",
                ativo
                  ? "border-slate-800 ring-1 ring-slate-800"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span className="block h-20 rounded-md overflow-hidden border border-slate-200">
                {o.id === "sistema" ? (
                  <span className="flex h-full">
                    <span className="w-1/2 overflow-hidden">
                      <Miniatura escuro={false} />
                    </span>
                    <span className="w-1/2 overflow-hidden">
                      <Miniatura escuro />
                    </span>
                  </span>
                ) : (
                  <Miniatura escuro={o.id === "escuro"} />
                )}
              </span>
              <span className="mt-3 flex items-center gap-2">
                <o.Icon className="size-4 shrink-0 text-slate-500" />
                <span className="text-sm font-medium text-slate-900">
                  {o.titulo}
                </span>
                {ativo && <Check className="ml-auto size-4 text-slate-800" />}
              </span>
              <span className="block mt-0.5 text-xs text-slate-500">
                {o.descricao}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

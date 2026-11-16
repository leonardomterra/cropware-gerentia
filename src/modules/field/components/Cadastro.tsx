import type { KeyboardEvent, ReactNode } from "react";
import DotsThree from "~icons/ph/dots-three-vertical";
import { Label } from "@/components/ui/label";
import { Obrigatorio } from "@/components/ui/Obrigatorio";
import { Ajuda } from "@/components/ui/Ajuda";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";

/**
 * Peças comuns das telas de cadastro do Field (produtores, fazendas, talhões),
 * no padrão de docs/PADRAO-DE-PAGINA.md: o clique no cartão abre em LEITURA;
 * o menu ⋯ tem Ver → Editar → Excluir, com stopPropagation.
 */
export function CartaoDeCadastro({
  titulo,
  linhas,
  miniatura,
  selos,
  faixa,
  aoAbrir,
  aoEditar,
  aoExcluir,
}: {
  titulo: string;
  linhas: (ReactNode | null | false | undefined)[];
  miniatura?: ReactNode;
  selos?: ReactNode;
  /** Faixa colorida à esquerda (ex.: irrigado/sequeiro). */
  faixa?: string;
  aoAbrir: () => void;
  /** Ausente = sem permissão (o item some do menu). */
  aoEditar?: () => void;
  aoExcluir?: () => void;
}) {
  const teclado = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      aoAbrir();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={aoAbrir}
      onKeyDown={teclado}
      className="relative bg-white rounded-lg border border-slate-200 p-3 flex gap-3 cursor-pointer hover:border-slate-300 transition-colors overflow-hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
    >
      {faixa && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: faixa }}
        />
      )}
      {miniatura && <div className="shrink-0">{miniatura}</div>}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start gap-2">
          <h3 className="font-medium text-slate-900 truncate flex-1">
            {titulo}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Ações de ${titulo}`}
                onClick={(e) => e.stopPropagation()}
                className="-mt-1 -mr-1 size-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <DotsThree className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onSelect={aoAbrir}>Ver</DropdownMenuItem>
              {aoEditar && (
                <DropdownMenuItem onSelect={aoEditar}>Editar</DropdownMenuItem>
              )}
              {aoExcluir && (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onSelect={aoExcluir}>
                    Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {linhas.filter(Boolean).map((l, i) => (
          <p key={i} className="text-sm text-slate-500 truncate">
            {l}
          </p>
        ))}
        {selos && <div className="flex flex-wrap gap-1.5 pt-1">{selos}</div>}
      </div>
    </div>
  );
}

/** Rótulo + campo, com obrigatório e (?) opcionais. */
export function Campo({
  rotulo,
  htmlFor,
  obrigatorio,
  ajuda,
  erro,
  className,
  children,
}: {
  rotulo: string;
  htmlFor?: string;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
  erro?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-sm text-slate-700"
      >
        {rotulo}
        {obrigatorio && <Obrigatorio />}
        {ajuda && <Ajuda>{ajuda}</Ajuda>}
      </Label>
      {children}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}

/** Grade de cartões da lista — 1 coluna no celular, até 3 no desktop. */
export function GradeDeCartoes({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {children}
    </div>
  );
}

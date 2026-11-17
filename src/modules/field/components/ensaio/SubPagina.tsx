import type { ReactNode } from "react";
import ArrowLeft from "~icons/ph/arrow-left";
import Save from "~icons/ph/floppy-disk";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA } from "@/lib/ui-tokens";

/**
 * Formulário de uma parte do ensaio (produto, etapa, avaliação, colheita) que
 * ABRE NO LUGAR DA ABA — o mesmo gesto da PaginaDeFormulario, um nível abaixo.
 * Como o SubPaginaDeFormulario do Flag Field.
 */
export function SubPagina({
  titulo,
  formId,
  rotuloSalvar = "Salvar",
  salvando,
  aoVoltar,
  somenteLeitura,
  children,
}: {
  titulo: string;
  formId: string;
  rotuloSalvar?: string;
  salvando?: boolean;
  aoVoltar: () => void;
  somenteLeitura?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={aoVoltar}
          className={cn(BOTAO_BARRA, "rounded-md")}
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar ao ensaio
        </Button>
        {!somenteLeitura && (
          <Button
            type="submit"
            form={formId}
            disabled={salvando}
            className="h-9 px-5 font-normal shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="size-4 mr-2" />
            {salvando ? "Salvando..." : rotuloSalvar}
          </Button>
        )}
        <span className="text-sm text-slate-400 truncate">{titulo}</span>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 md:p-6">
        <fieldset disabled={somenteLeitura} className="contents">
          {children}
        </fieldset>
      </div>
    </div>
  );
}

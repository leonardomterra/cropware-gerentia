import React from "react";
import ArrowLeft from "~icons/ph/arrow-left";
import Pencil from "~icons/ph/pencil-simple";
import Lock from "~icons/ph/lock";
import Save from "~icons/ph/floppy-disk";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { cn } from "./utils";

interface PaginaDeFormularioProps {
  /** `form` do botão Salvar — o formulário fica fora do botão, então precisa do id. */
  formId: string;
  /** "Salvar" ao editar, "Criar Lançamento" ao criar. */
  rotuloSalvar: string;
  /** "Editando Internet Uberaba" ou "Novo lançamento" — o contexto do que está aberto. */
  descricao: string;
  /**
   * VER É ESTA MESMA PÁGINA, TRAVADA. O formulário entra num `<fieldset
   * disabled>` e o botão do topo passa a ser *Editar*.
   */
  somenteLeitura?: boolean;
  /** Chamado pelo botão *Editar*. Ausente = sem permissão de editar. */
  aoEditar?: () => void;
  /** Sai da página. Recebe a função de cancelar DO FORMULÁRIO quando ela existe,
   *  porque é ela que checa alterações não salvas — o cabeçalho não tem como
   *  saber se o usuário digitou algo. */
  aoVoltar: () => void;
  salvando?: boolean;
  children: React.ReactNode;
}

/**
 * Casca das telas de cadastro que são PÁGINA, não diálogo.
 * Portada do Flag Field (docs/ADOCAO-DESIGN-FLAGFIELD.md).
 *
 * **Por que página:** num diálogo o teclado virtual do iOS espreme o conteúdo, a
 * rolagem do modal briga com a da tela atrás (`max-h` + `overflow-y-auto` dentro
 * de uma página que já rola), e sobra menos largura útil no celular. Para
 * formulário de cadastro — que é longo e se preenche devagar — isso pesa. Para
 * confirmar, escolher e ver algo curto, o diálogo continua sendo o certo.
 *
 * Este arquivo existe para a casca não ser recopiada a cada tela convertida.
 */
export function PaginaDeFormulario({
  formId,
  rotuloSalvar,
  descricao,
  aoVoltar,
  salvando = false,
  somenteLeitura = false,
  aoEditar,
  children,
}: PaginaDeFormularioProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 w-full">
        <Button
          type="button"
          variant="outline"
          onClick={aoVoltar}
          className="h-9 px-4 font-normal"
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar
        </Button>

        {somenteLeitura ? (
          aoEditar ? (
            <Button
              type="button"
              onClick={aoEditar}
              className="h-9 px-5 font-normal shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Pencil className="size-4 mr-2" />
              Editar
            </Button>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Lock className="size-4" />
              Somente leitura
            </span>
          )
        ) : (
          /* Um botão só, que troca de rótulo: "Editar" vira "Salvar" na MESMA
             posição. Sem Cancelar — cancelar era salvar o que já estava lá. */
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

        <span className="text-sm text-slate-400 font-normal truncate min-w-0">
          {descricao}
        </span>
      </div>

      <Card
        className={cn(
          "border-slate-200 shadow-none bg-white",
          somenteLeitura && "modo-leitura",
        )}
      >
        <CardContent className="p-4 md:p-6">
          {/* UM fieldset desliga o formulário inteiro — nenhum campo precisa
              saber que existe modo leitura. `contents` para não criar caixa. */}
          <fieldset disabled={somenteLeitura} className="contents">
            {children}
          </fieldset>
        </CardContent>
      </Card>
    </div>
  );
}

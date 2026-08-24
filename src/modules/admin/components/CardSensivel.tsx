import { type ReactNode, useState } from "react";
import CaretDown from "~icons/ph/caret-down";
import InfoDuotone from "~icons/ph/info-duotone";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA } from "@/lib/ui-tokens";

/**
 * Card de campo SENSÍVEL — trocar a senha ou o e-mail de outra pessoa.
 *
 * Três travas em série, porque aqui o master mexe na credencial de acesso de
 * um cliente e o erro não tem desfazer:
 *
 *  1. RECOLHIDO por padrão, em tom de atenção. O que não está aberto não é
 *     preenchido por engano nem por autofill do navegador.
 *  2. CAMPOS DESLIGADOS até um clique explícito em destravar. Abrir para ler o
 *     que existe é diferente de abrir para mudar.
 *  3. CONFIRMAÇÃO no fim, listando quem é o alvo — o master edita muita gente
 *     em sequência, e a pergunta é "esta é mesmo a pessoa certa?".
 *
 * A ação é SEPARADA do "Salvar" do formulário de propósito: senha e e-mail não
 * são campos de perfil, e misturá-los com nome e cidade faria um salvar de
 * rotina carregar uma troca de credencial.
 */
export function CardSensivel({
  titulo,
  descricao,
  destravado,
  aoDestravar,
  rotuloDestravar,
  avisoTravado,
  acao,
  children,
}: {
  titulo: string;
  descricao: string;
  destravado: boolean;
  aoDestravar: () => void;
  rotuloDestravar: string;
  /** Explica por que os campos estão apagados. Some ao destravar. */
  avisoTravado: string;
  /** Botão de confirmar, mostrado só quando destravado. */
  acao: ReactNode;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-amber-100/60 transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-amber-900">
            {titulo}
          </span>
          {/* slate-600 e não o 500 dos cards brancos: sobre o âmbar o 500 cai
              abaixo de 4,5:1. */}
          <span className="block text-sm text-slate-600">{descricao}</span>
        </span>
        <CaretDown
          className={cn(
            "size-4 shrink-0 text-amber-900 transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3 border-t border-amber-200 pt-3">
          {children}
          {/* Campo apagado sem explicação lê-se como defeito — e a saída
              (o botão logo abaixo) não é óbvia por si só. O aviso fica
              COLADO nele, para o texto e a ação serem lidos juntos. */}
          {!destravado && (
            <p className="flex items-start gap-2 text-sm text-slate-600">
              <InfoDuotone className="size-[18px] shrink-0 text-amber-600 mt-px" />
              <span>{avisoTravado}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {destravado ? (
              acao
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={aoDestravar}
                className={cn(BOTAO_BARRA, "rounded-md bg-white")}
              >
                {rotuloDestravar}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

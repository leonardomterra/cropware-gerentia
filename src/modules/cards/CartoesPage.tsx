import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CreditCard from "~icons/ph/credit-card";
import Plus from "~icons/ph/plus";
import ChevronDown from "~icons/ph/caret-down";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOTAO_BARRA_PRIMARIO, CAMPO_BARRA } from "@/lib/ui-tokens";
import { rotuloDoCartao, useCards } from "./useCards";
import { FaturaView } from "./FaturaView";
import ArrowLeft from "~icons/ph/arrow-left";
import CreditCardDuotone from "~icons/ph/credit-card-duotone";
import ReceiptDuotone from "~icons/ph/receipt-duotone";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA } from "@/lib/ui-tokens";
import { ReceiptsListPage } from "@/modules/receipts/components/ReceiptsListPage";
import type { Receipt } from "@/modules/receipts/types";
import { CardsManager } from "./CardsManager";

type Secao = "cartoes" | "faturas";

interface Atalho {
  id: Secao;
  Icon: typeof CreditCardDuotone;
  cor: string;
  titulo: string;
  descricao: string;
}

const ATALHOS: Atalho[] = [
  {
    id: "cartoes",
    Icon: CreditCardDuotone,
    cor: "text-violet-500",
    titulo: "Meus Cartões",
    descricao: "Cadastrar, editar e desativar",
  },
  {
    id: "faturas",
    Icon: ReceiptDuotone,
    cor: "text-sky-500",
    titulo: "Faturas",
    descricao: "Consultar e lançar faturas",
  },
];

/**
 * Cartões — HUB, no molde de Configurações (docs/PADRAO-DE-PAGINA.md §9).
 *
 * Era a aba "Faturas", que mostrava só a lista. Virou hub em 25/08/2026 porque
 * o assunto cresceu: desde que a FATURA passou a ser o que soma
 * (docs/CARTOES-E-FATURAS.md), o cliente precisa cadastrar os cartões, saber de
 * qual deles é cada fatura e — mais adiante — conciliar o que veio na fatura
 * com o que ele lançou.
 *
 * O hub aparece mesmo com um cartão só. A alternativa seria ir direto na lista
 * quando houver um, e no hub quando houver dois — dois caminhos para manter, por
 * um clique de economia num caso que dura pouco.
 */
export default function CartoesPage() {
  const [params] = useSearchParams();
  // `?open=<id>` é link direto para uma fatura — vem de "Gerenciar itens" e do
  // /faturas antigo. Cair no hub aqui seria abrir a gaveta em vez do documento.
  const [secao, setSecao] = useState<Secao | null>(
    params.has("open") ? "faturas" : null,
  );
  // O formulário do CardsManager desenha a PRÓPRIA barra (Voltar + Salvar). A
  // do hub some enquanto isso, senão ficam dois "Voltar" empilhados.
  const [formAberto, setFormAberto] = useState(false);
  // Ação principal da seção, entregue pelo manager para morar NA barra, ao lado
  // do Voltar. Guardada como função dentro de função porque `setState(fn)` trata
  // função como updater — sem o embrulho, o React a chamaria na hora.
  const [acao, setAcao] = useState<(() => void) | null>(null);
  const { cards } = useCards();
  // "todos" | "sem" | <id>. "sem" existe porque as faturas anteriores ao
  // cadastro de cartões não têm vínculo, e achá-las é o primeiro passo para
  // arrumá-las.
  const [filtroCartao, setFiltroCartao] = useState("todos");

  /**
   * O filtro da lista combina "é fatura" com o cartão escolhido.
   *
   * `useCallback` porque `ReceiptsListPage` guarda o `docFilter` num `useMemo`:
   * uma função nova a cada render refiltraria a lista inteira sem motivo.
   */
  const filtroDeFaturas = useCallback(
    (r: Receipt) => {
      if (r.doc_type !== "fatura") return false;
      if (filtroCartao === "todos") return true;
      if (filtroCartao === "sem") return !r.card_id;
      return r.card_id === filtroCartao;
    },
    [filtroCartao],
  );

  if (!secao) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ATALHOS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setFormAberto(false);
              setAcao(null);
              setSecao(a.id);
            }}
            className="text-left bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
          >
            <a.Icon className={cn("size-7 shrink-0", a.cor)} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">
                {a.titulo}
              </span>
              <span className="block text-sm text-slate-500">
                {a.descricao}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  const atalho = ATALHOS.find((a) => a.id === secao)!;

  return (
    <div className="space-y-4">
      {!formAberto && (
        <div className="flex flex-wrap items-center gap-3 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSecao(null)}
            className={cn(BOTAO_BARRA, "rounded-md")}
          >
            <ArrowLeft className="size-4 mr-2" />
            Voltar
          </Button>

          {acao && (
            <Button
              variant="default"
              onClick={acao}
              className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto")}
            >
              <Plus className="size-4 mr-2" />
              Novo Cartão
            </Button>
          )}

          {/* Assunto à direita, como em Conta e Configurações: à esquerda ficam as
            ações, e o título é rótulo — não coisa para clicar. */}
          <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
            <atalho.Icon className={cn("size-[18px] shrink-0", atalho.cor)} />
            <span className="truncate">{atalho.titulo}</span>
          </span>
        </div>
      )}

      {secao === "cartoes" && (
        <CardsManager
          aoAbrirFormulario={setFormAberto}
          aoRegistrarAcao={setAcao}
        />
      )}
      {secao === "faturas" && (
        <ReceiptsListPage
          aoAbrirFormulario={setFormAberto}
          renderLeitura={({ receipt, aoVoltar, aoEditar }) => (
            <FaturaView
              receipt={receipt}
              cards={cards}
              aoVoltar={aoVoltar}
              aoEditar={aoEditar}
            />
          )}
          docFilter={filtroDeFaturas}
          camposExtra={
            // Só aparece quando há cartão cadastrado: com zero, o seletor seria
            // um campo com uma opção só.
            cards.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={CAMPO_BARRA}>
                    <CreditCard className="size-[18px] shrink-0 text-slate-500" />
                    <span className="flex-1 text-left truncate">
                      {filtroCartao === "todos"
                        ? "Todos os Cartões"
                        : filtroCartao === "sem"
                          ? "Sem cartão"
                          : (cards.find((c) => c.id === filtroCartao)?.nome ??
                            "Cartão")}
                    </span>
                    <ChevronDown className="size-4 text-slate-500 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem onClick={() => setFiltroCartao("todos")}>
                    Todos os Cartões
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFiltroCartao("sem")}>
                    Sem cartão
                  </DropdownMenuItem>
                  {cards.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => setFiltroCartao(c.id)}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {rotuloDoCartao(c)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined
          }
          itemized
          defaultDocType="fatura"
          showCapture={false}
          createLabel="Nova Fatura"
          createLabelShort="Nova"
          emptyLabel="Sem faturas"
          countNoun={{ one: "fatura", many: "faturas", genero: "f" }}
          titleNew="Nova Fatura"
          titleEdit="Editar Fatura"
        />
      )}
    </div>
  );
}

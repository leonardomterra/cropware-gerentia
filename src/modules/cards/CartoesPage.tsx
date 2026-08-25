import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import ArrowLeft from "~icons/ph/arrow-left";
import CreditCardDuotone from "~icons/ph/credit-card-duotone";
import ReceiptDuotone from "~icons/ph/receipt-duotone";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA } from "@/lib/ui-tokens";
import { ReceiptsListPage } from "@/modules/receipts/components/ReceiptsListPage";
import type { Receipt } from "@/modules/receipts/types";
import { CardsManager } from "./CardsManager";

// Referência estável (módulo) pra não invalidar o useMemo do filtro.
const isFatura = (r: Receipt) => r.doc_type === "fatura";

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

  if (!secao) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ATALHOS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSecao(a.id)}
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

        {/* Assunto à direita, como em Conta e Configurações: à esquerda ficam as
            ações, e o título é rótulo — não coisa para clicar. */}
        <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
          <atalho.Icon className={cn("size-[18px] shrink-0", atalho.cor)} />
          <span className="truncate">{atalho.titulo}</span>
        </span>
      </div>

      {secao === "cartoes" && <CardsManager />}
      {secao === "faturas" && (
        <ReceiptsListPage
          docFilter={isFatura}
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

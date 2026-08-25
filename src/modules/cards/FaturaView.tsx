import { useMemo } from "react";
import CreditCardDuotone from "~icons/ph/credit-card-duotone";
import WarningDuotone from "~icons/ph/warning-duotone";
import PencilSimple from "~icons/ph/pencil-simple";
import ArrowLeft from "~icons/ph/arrow-left";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import { useAuth } from "@/contexts/AuthContext";
import { BOTAO_BARRA, BOTAO_BARRA_PRIMARIO } from "@/lib/ui-tokens";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import {
  formatBRL,
  getCategoryLabel,
} from "@/modules/receipts/utils/receiptFormatters";
import type { Receipt } from "@/modules/receipts/types";
import { rotuloDoCartao } from "./useCards";
import type { Card } from "./types";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "Agosto de 2026" a partir de `competencia` (AAAA-MM-01). */
function competenciaLonga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [a, m] = iso.slice(0, 10).split("-");
  const i = Number(m) - 1;
  return MESES[i] ? `${MESES[i]} de ${a}` : null;
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Dia e mês, sem o ano: dentro de uma fatura o ano é sempre o mesmo. */
function diaMes(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

const STATUS: Record<string, { rotulo: string; cor: string }> = {
  a_pagar: {
    rotulo: "A pagar",
    cor: "text-amber-700 bg-amber-50 border-amber-200",
  },
  pago: {
    rotulo: "Paga",
    cor: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  vencido: { rotulo: "Vencida", cor: "text-red-700 bg-red-50 border-red-200" },
  cancelado: {
    rotulo: "Cancelada",
    cor: "text-slate-600 bg-slate-50 border-slate-200",
  },
};

/** Bloco de número do cabeçalho: rótulo pequeno em cima, valor grande embaixo. */
function Dado({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3 min-w-0">
      <span className="block text-sm text-slate-500">{rotulo}</span>
      <span
        className={cn(
          "block mt-0.5 truncate tabular-nums",
          destaque
            ? "text-lg font-semibold text-slate-900"
            : "text-sm text-slate-900",
        )}
      >
        {valor}
      </span>
    </div>
  );
}

/**
 * Tela de uma FATURA — dedicada, não o formulário genérico de lançamento.
 *
 * O formulário genérico servia mal aqui: falava de "Tipo de Documento",
 * "Origem" e "Número da Nota Fiscal" — vocabulário de nota — e não dizia de qual
 * cartão a fatura era. Uma tela que serve mal aos dois é pior que duas telas
 * honestas.
 *
 * Duas seções, e a divisão é a do próprio documento: o CABEÇALHO é o que o banco
 * cobra (cartão, competência, vencimento, total) e os LANÇAMENTOS são o que
 * compõe aquele valor. É onde a conciliação da etapa 5 vai morar.
 */
export function FaturaView({
  receipt,
  cards,
  aoVoltar,
  aoEditar,
}: {
  receipt: Receipt;
  cards: Card[];
  aoVoltar: () => void;
  aoEditar?: () => void;
}) {
  const { allCategories: categories } = useCategories();
  const { user } = useAuth();
  const ccById = useMemo(
    () => new Map((user?.costCenters ?? []).map((c) => [c.id, c])),
    [user],
  );

  const cartao = cards.find((c) => c.id === receipt.card_id) ?? null;
  const itens = (receipt.items ?? []).filter((i) => !i.promoted_to_receipt_id);
  const somaItens = itens.reduce((s, i) => s + (Number(i.total_value) || 0), 0);
  const total = Number(receipt.total_value) || 0;
  // A fatura tem que fechar com a soma dos itens. Quando não fecha, é sinal de
  // item faltando na leitura da foto — e é melhor dizer isso do que exibir dois
  // números diferentes na mesma tela sem comentar.
  const divergencia = itens.length > 0 && Math.abs(somaItens - total) > 0.01;
  const st = STATUS[receipt.status] ?? {
    rotulo: receipt.status,
    cor: "text-slate-600 bg-slate-50 border-slate-200",
  };
  const competencia = competenciaLonga(receipt.competencia);

  return (
    <div className="space-y-4">
      {/* Barra: Voltar à esquerda, ação principal ao lado, identidade à direita —
          o mesmo arranjo de Conta e Configurações. */}
      <div className="flex flex-wrap items-center gap-3 w-full">
        <Button
          type="button"
          variant="ghost"
          onClick={aoVoltar}
          className={cn(BOTAO_BARRA, "rounded-md")}
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar
        </Button>
        {aoEditar && (
          <Button
            variant="default"
            onClick={aoEditar}
            className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto")}
          >
            <PencilSimple className="size-4 mr-2" />
            Editar
          </Button>
        )}
        <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
          <CreditCardDuotone className="size-[18px] shrink-0 text-violet-500" />
          <span className="truncate">Fatura</span>
        </span>
      </div>

      {/* ---- Seção 1: o cabeçalho da fatura ---- */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <CreditCardDuotone
              className={cn(
                "size-8 shrink-0",
                cartao ? "text-violet-500" : "text-slate-400",
              )}
            />
            <div className="min-w-0">
              {cartao ? (
                <>
                  <span className="block text-sm font-medium text-slate-900">
                    {rotuloDoCartao(cartao)}
                  </span>
                  <span className="block text-sm text-slate-500">
                    {[cartao.emissor, competencia]
                      .filter(Boolean)
                      .join(" - ") || "—"}
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-sm font-medium text-slate-900">
                    Sem cartão vinculado
                  </span>
                  {/* Aviso e não erro: a fatura vale mesmo sem vínculo. Só não
                      dá para conciliar nem para saber de quem ela é. */}
                  <span className="block text-sm text-slate-500">
                    Edite a fatura e escolha o cartão — sem ele não dá para
                    conferir os lançamentos contra as compras.
                  </span>
                </>
              )}
            </div>
          </div>
          <Badge size="compact" className={cn("border", st.cor)}>
            {st.rotulo}
          </Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Dado rotulo="Total" valor={formatBRL(total)} destaque />
          <Dado rotulo="Vencimento" valor={dataBR(receipt.due_date)} />
          <Dado rotulo="Fechamento" valor={dataBR(receipt.transaction_date)} />
          <Dado rotulo="Competência" valor={competencia ?? "não informada"} />
        </div>

        {divergencia && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <WarningDuotone className="size-[18px] shrink-0 text-amber-600 mt-px" />
            <p className="text-sm text-slate-700">
              Os lançamentos somam {formatBRL(somaItens)}, e a fatura diz{" "}
              {formatBRL(total)}. Faltam{" "}
              {formatBRL(Math.abs(total - somaItens))} — provavelmente uma
              compra que não foi lida.
            </p>
          </div>
        )}
      </section>

      {/* ---- Seção 2: os lançamentos ---- */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-medium text-slate-900">
            Lançamentos da fatura
          </h2>
          <span className="text-sm text-slate-500">
            {itens.length} {itens.length === 1 ? "lançamento" : "lançamentos"}
          </span>
        </div>

        {itens.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-700">
              Esta fatura não tem lançamentos detalhados.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Faturas lançadas à mão trazem só o total. Enviando a foto da
              fatura, o sistema separa as compras uma a uma.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500 whitespace-nowrap">
                    Data
                  </th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">
                    Estabelecimento
                  </th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">
                    Categoria
                  </th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-slate-500">
                    Centro de Custo
                  </th>
                  <th className="text-right px-4 py-2 text-sm font-medium text-slate-500 whitespace-nowrap">
                    Valor R$
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => {
                  const cc = it.cost_center_id
                    ? ccById.get(it.cost_center_id)
                    : null;
                  return (
                    <tr
                      key={it.id}
                      className={cn(
                        "border-b border-slate-100",
                        i % 2 === 1 && "bg-slate-50/60",
                      )}
                    >
                      {/* Sem data: a compra veio de uma fatura antiga ou de um
                          lançamento à mão. Um traço é honesto; inventar a data
                          do pai faria o item mentir. */}
                      <td className="px-4 py-2.5 text-sm tabular-nums whitespace-nowrap text-slate-600">
                        {diaMes(it.purchase_date)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-900">
                        {it.description || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">
                        {getCategoryLabel(it.category, categories)}
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {cc ? (
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <CostCenterChip
                              icon={cc.icon}
                              color={cc.color}
                              className="size-4 shrink-0"
                            />
                            <span className="truncate text-slate-600">
                              {cc.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right tabular-nums whitespace-nowrap text-slate-900">
                        {formatBRL(it.total_value)}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-right tabular-nums whitespace-nowrap text-slate-900">
                    {formatBRL(somaItens)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

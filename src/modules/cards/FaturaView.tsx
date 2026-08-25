import { useEffect, useMemo, useState, type ReactNode } from "react";
import CreditCardDuotone from "~icons/ph/credit-card-duotone";
import WarningDuotone from "~icons/ph/warning-duotone";
import CheckCircleDuotone from "~icons/ph/check-circle-duotone";
import QuestionDuotone from "~icons/ph/question-duotone";
import { api } from "@/utils/api";
import PencilSimple from "~icons/ph/pencil-simple";
import ArrowLeft from "~icons/ph/arrow-left";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ajuda } from "@/components/ui/Ajuda";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import { useAuth } from "@/contexts/AuthContext";
import { BOTAO_BARRA, BOTAO_BARRA_PRIMARIO } from "@/lib/ui-tokens";
import { useCategories } from "@/modules/receipts/hooks/useCategories";
import {
  formatBRL,
  getCategoryLabel,
} from "@/modules/receipts/utils/receiptFormatters";
import type { FarmCategory, Receipt } from "@/modules/receipts/types";
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

interface ItemConciliado {
  item_id: string;
  receipt_id: string | null;
  confianca: "alta" | "media" | null;
  por: string[];
}
interface Conciliacao {
  itens: ItemConciliado[];
  nao_registrados: number;
  sobrando: {
    id: string;
    vendor: string | null;
    value: number;
    date: string | null;
    category: string | null;
    cost_center_id: string | null;
  }[];
}

/** Uma compra, no formato que a tabela desenha — venha ela da fatura ou de
 *  fora dela. */
interface LinhaDeCompra {
  id: string;
  date: string | null;
  descricao: string | null;
  category: string | null;
  cost_center_id: string | null;
  value: number;
  /** Ícone à esquerda da descrição (o selo de conciliação). */
  marca?: ReactNode;
  /** Fundo âmbar da linha não registrada. */
  destaque?: boolean;
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
 * Selo com dica, no vidro do app.
 *
 * `TooltipProvider` fica AQUI e não numa casca lá em cima: a tela é montada por
 * injeção dentro do ReceiptsListPage, e depender de um provider que talvez não
 * exista no caminho quebraria em silêncio — o Radix simplesmente não mostra
 * nada. O provider é barato e idempotente.
 */
function Marca({ dica, children }: { dica: string; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0">{children}</span>
        </TooltipTrigger>
        <TooltipContent>{dica}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * A tabela de compras, usada pelas DUAS seções — as da fatura e as de fora.
 *
 * É um componente só de propósito: o pedido foi que as duas ficassem parecidas,
 * e duas cópias divergiriam na primeira coluna que alguém acrescentasse. O que
 * muda entre elas é `esmaecida`, que é o jeito de dizer "isto aqui não compõe o
 * valor desta fatura" sem precisar de outro desenho.
 */
function TabelaDeCompras({
  linhas,
  ccById,
  categories,
  esmaecida = false,
}: {
  linhas: LinhaDeCompra[];
  ccById: Map<
    string,
    { icon?: string | null; color?: string | null; name: string }
  >;
  categories: FarmCategory[];
  esmaecida?: boolean;
}) {
  const total = linhas.reduce((s, l) => s + l.value, 0);
  const tinta = esmaecida ? "text-slate-400" : "text-slate-900";
  const tintaFraca = esmaecida ? "text-slate-400" : "text-slate-600";

  return (
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
          {linhas.map((l, i) => {
            const cc = l.cost_center_id ? ccById.get(l.cost_center_id) : null;
            return (
              <tr
                key={l.id}
                className={cn(
                  "border-b border-slate-100",
                  i % 2 === 1 && "bg-slate-50/60",
                  l.destaque && "bg-amber-50/60",
                )}
              >
                <td
                  className={cn(
                    "px-4 py-2.5 text-sm tabular-nums whitespace-nowrap",
                    tintaFraca,
                  )}
                >
                  {diaMes(l.date)}
                </td>
                <td className={cn("px-4 py-2.5 text-sm", tinta)}>
                  <span className="inline-flex items-center gap-2 min-w-0">
                    {l.marca}
                    <span className="truncate">{l.descricao || "—"}</span>
                  </span>
                </td>
                <td className={cn("px-4 py-2.5 text-sm", tintaFraca)}>
                  {getCategoryLabel(l.category, categories)}
                </td>
                <td className="px-4 py-2.5 text-sm">
                  {cc ? (
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <CostCenterChip
                        icon={cc.icon}
                        color={cc.color}
                        // Esmaecido o chip perde a cor junto com o resto —
                        // senão ele é a única coisa viva numa linha apagada.
                        className={cn(
                          "size-4 shrink-0",
                          esmaecida && "opacity-40 grayscale",
                        )}
                      />
                      <span className={cn("truncate", tintaFraca)}>
                        {cc.name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-sm text-right tabular-nums whitespace-nowrap",
                    tinta,
                  )}
                >
                  {formatBRL(l.value)}
                </td>
              </tr>
            );
          })}
          <tr>
            <td
              colSpan={4}
              className={cn(
                "px-4 py-3 text-sm font-medium",
                esmaecida ? "text-slate-400" : "text-slate-700",
              )}
            >
              Total
            </td>
            <td
              className={cn(
                "px-4 py-3 text-sm font-semibold text-right tabular-nums whitespace-nowrap",
                esmaecida ? "text-slate-400" : "text-slate-900",
              )}
            >
              {formatBRL(total)}
            </td>
          </tr>
        </tbody>
      </table>
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

  // Conciliação: quais linhas da fatura o usuário já tinha lançado. O cálculo
  // mora no servidor (lib/conciliacao.ts) porque o WhatsApp vai usar a mesma
  // conta — duas implementações divergiriam na primeira correção.
  const [conc, setConc] = useState<Conciliacao | null>(null);
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const r = await api<Conciliacao>(`/faturas/${receipt.id}/conciliacao`);
        if (!cancelado) setConc(r);
      } catch {
        // Silencioso: a fatura se lê perfeitamente sem a conciliação. Ela é um
        // extra, e derrubar a tela por causa dela seria desproporcional.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [receipt.id]);

  const porItem = useMemo(
    () => new Map((conc?.itens ?? []).map((i) => [i.item_id, i])),
    [conc],
  );

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
          <div className="flex items-center gap-3">
            {conc && conc.nao_registrados > 0 && (
              // O número que interessa. Não é erro — é descoberta: são as
              // compras que passaram no cartão e nunca foram lançadas.
              <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
                <QuestionDuotone className="size-[18px] shrink-0 text-amber-600" />
                {conc.nao_registrados} não{" "}
                {conc.nao_registrados === 1 ? "registrada" : "registradas"}
              </span>
            )}
            <span className="text-sm text-slate-500">
              {itens.length} {itens.length === 1 ? "lançamento" : "lançamentos"}
            </span>
          </div>
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
          <TabelaDeCompras
            categories={categories}
            ccById={ccById}
            linhas={itens.map((it) => {
              const m = porItem.get(it.id);
              return {
                id: it.id,
                date: it.purchase_date ?? null,
                descricao: it.description,
                category: it.category,
                cost_center_id: it.cost_center_id,
                value: Number(it.total_value) || 0,
                // Só marca quando a conciliação JÁ respondeu: antes disso toda
                // linha pareceria não registrada por um instante.
                destaque: !!conc && !m?.receipt_id,
                // O tooltip é o do APP, não o `title` do HTML — aquele
                // renderiza a caixinha cinza do sistema operacional, que não
                // tem nada a ver com o resto da interface.
                marca: m?.receipt_id ? (
                  <Marca
                    // Explica POR QUE casou: sem isso o selo é um carimbo em
                    // que não dá para confiar.
                    dica={`Você já lançou esta compra — confere ${m.por.join(", ")}`}
                  >
                    <CheckCircleDuotone
                      className={cn(
                        "size-[18px] shrink-0",
                        m.confianca === "alta"
                          ? "text-emerald-500"
                          : "text-slate-400",
                      )}
                    />
                  </Marca>
                ) : conc ? (
                  <Marca dica="Não encontrei esta compra nos seus lançamentos">
                    <QuestionDuotone className="size-[18px] shrink-0 text-amber-500" />
                  </Marca>
                ) : null,
              };
            })}
          />
        )}
      </section>

      {/* O outro lado: compras lançadas no cartão que NÃO entraram nesta
          fatura. Mesma tabela, ESMAECIDA — é o jeito de dizer "isto não compõe
          o valor desta fatura" sem inventar outro desenho. */}
      {conc && conc.sobrando.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
              Fora desta fatura
              <Ajuda>
                Compras lançadas neste cartão que não apareceram na fatura.
                Normalmente são as feitas depois do fechamento, que caem na
                próxima. Se alguma não for, pode estar no cartão errado.
              </Ajuda>
            </h2>
            <span className="text-sm text-slate-500">
              {conc.sobrando.length}{" "}
              {conc.sobrando.length === 1 ? "compra" : "compras"}
            </span>
          </div>
          <TabelaDeCompras
            esmaecida
            categories={categories}
            ccById={ccById}
            linhas={conc.sobrando.map((c) => ({
              id: c.id,
              date: c.date,
              descricao: c.vendor,
              category: c.category,
              cost_center_id: c.cost_center_id,
              value: c.value,
            }))}
          />
        </section>
      )}
    </div>
  );
}

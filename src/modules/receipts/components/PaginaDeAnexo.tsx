import ArrowLeft from "~icons/ph/arrow-left";
import Download from "~icons/ph/download-simple";
import ArrowSquareOut from "~icons/ph/arrow-square-out";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BOTAO_BARRA } from "@/lib/ui-tokens";
import { cn } from "@/components/ui/utils";
import { openExternalUrl } from "@/utils/nativeExport";
import { useAuth } from "@/contexts/AuthContext";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import type { Receipt } from "../types";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { useCategories } from "../hooks/useCategories";
import { AttachmentViewer } from "./AttachmentViewer";
import {
  DOC_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  STATUS_COLOR_SCHEME,
  STATUS_LABEL,
} from "../constants";
import {
  formatBRL,
  formatDateBR,
  getCategoryLabel,
} from "../utils/receiptFormatters";

interface PaginaDeAnexoProps {
  receipt: Receipt;
  aoVoltar: () => void;
}

/**
 * Ver anexo como PÁGINA, a partir de uma lista — mesmo molde de
 * `PaginaDeFormulario`: Voltar à esquerda, a ação principal ao lado, o nome do
 * arquivo como contexto, e o conteúdo num card.
 *
 * Página e não diálogo pelo mesmo motivo dos formulários: no celular o modal
 * espreme o conteúdo e a rolagem dele briga com a da página atrás — e anexo é
 * justamente o que se quer olhar grande e rolar.
 *
 * A partir do FORMULÁRIO de lançamento o caminho continua sendo o diálogo
 * (`AttachmentViewerDialog`): lá ver o anexo é uma espiada, e a tela de trás
 * precisa continuar de pé com o que já foi digitado.
 */
export function PaginaDeAnexo({ receipt, aoVoltar }: PaginaDeAnexoProps) {
  const { url } = useAttachmentUrl(receipt.id, !!receipt.attachment_key);
  const { categories } = useCategories();
  const { user } = useAuth();
  const isPdf = (receipt.attachment_mime ?? "") === "application/pdf";
  const titulo = receipt.vendor || receipt.description || "Arquivo";
  const cc = (user?.costCenters ?? []).find(
    (c) => c.id === receipt.cost_center_id,
  );

  const categoria = receipt.category
    ? getCategoryLabel(receipt.category, categories)
    : "Sem categoria";
  const documento = receipt.invoice_number
    ? `${DOC_TYPE_LABEL[receipt.doc_type]} nº ${receipt.invoice_number}`
    : DOC_TYPE_LABEL[receipt.doc_type];
  const quando = receipt.transaction_date
    ? formatDateBR(receipt.transaction_date)
    : receipt.due_date
      ? `vence ${formatDateBR(receipt.due_date)}`
      : "sem data";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 w-full">
        {/* Sem borda, no cinza do Flag Field (`BOTAO_BARRA`): Voltar é a saída,
            não uma escolha — contornado, ele competia com a ação principal ao
            lado. É o mesmo cinza dos botões de Filtros e Ordenar. */}
        <Button
          type="button"
          variant="ghost"
          onClick={aoVoltar}
          className={cn(BOTAO_BARRA, "rounded-md")}
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar
        </Button>

        {/* Mesmo cinza do Voltar: aqui não há ação principal a destacar — o
            anexo já está na tela, e abrir fora é só uma alternativa. O escuro
            é reservado para criar/salvar. */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => url && openExternalUrl(url)}
          disabled={!url}
          className={cn(BOTAO_BARRA, "gap-1.5 rounded-md")}
        >
          {isPdf ? (
            <ArrowSquareOut className="size-[18px] shrink-0" />
          ) : (
            <Download className="size-[18px] shrink-0" />
          )}
          {isPdf ? "Abrir em Nova Aba" : "Baixar"}
        </Button>
      </div>

      {/* Ficha do lançamento, no MESMO molde do card de Recorrências: colunas
          de duas linhas, um tamanho só, tom por posição (900 em cima, 700
          embaixo), peso só na primeira linha da primeira coluna.

          Ela existe porque o anexo sozinho não diz sob que lançamento está
          arquivado — e é contra esses números que a pessoa confere o recibo.
          Vencimento e descrição ficaram de fora: o que identifica já está no
          título, e coluna a mais aqui competia com o documento em si. */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-stretch">
          <div
            aria-hidden
            className="w-1 shrink-0"
            style={{ backgroundColor: cc?.color ?? "#e5e5e5" }}
          />
          <div className="flex-1 min-w-0 p-4">
            <div className="flex items-start gap-4">
              {/* 1 — o quê */}
              <div className="min-w-0 flex-[1.2] flex flex-col gap-0.5">
                <p className="h-5 text-sm font-medium text-slate-900 truncate">
                  {titulo}
                </p>
                <p className="text-sm leading-5 text-slate-700 truncate">
                  {categoria}
                </p>
              </div>

              {/* 2 — quanto e quando */}
              <div className="min-w-0 flex-[0.8] flex flex-col gap-0.5">
                <p className="h-5 text-sm text-slate-900 truncate tabular-nums">
                  {receipt.direction === "income" ? "+" : "−"}
                  {formatBRL(receipt.total_value)}
                </p>
                <p className="text-sm leading-5 text-slate-700 truncate tabular-nums">
                  {quando}
                </p>
              </div>

              {/* 3 — que papel é este */}
              <div className="min-w-0 flex-1 hidden md:flex flex-col gap-0.5">
                <p className="h-5 text-sm text-slate-900 truncate">
                  {documento}
                </p>
                <p className="text-sm leading-5 text-slate-700 truncate">
                  {receipt.payment_method
                    ? PAYMENT_METHOD_LABEL[receipt.payment_method]
                    : "Sem forma de pagamento"}
                </p>
              </div>

              {/* 4 — centro de custo */}
              <div className="shrink-0 self-center hidden sm:flex items-center gap-2 min-w-0">
                {cc ? (
                  <>
                    <CostCenterChip
                      icon={cc.icon}
                      color={cc.color}
                      className="size-6 shrink-0"
                    />
                    <span className="text-sm text-slate-600 truncate">
                      {cc.name}
                    </span>
                  </>
                ) : null}
              </div>

              <div className="shrink-0 self-center">
                <Badge
                  colorScheme={
                    receipt.is_estimated
                      ? "orange"
                      : (STATUS_COLOR_SCHEME[receipt.status] ?? "slate")
                  }
                >
                  {receipt.is_estimated
                    ? "Previsto"
                    : STATUS_LABEL[receipt.status]}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-none bg-white">
        <CardContent className="p-2 md:p-4">
          {/* Sem `max-h`: aqui a página inteira rola, ao contrário do diálogo,
              onde a área do anexo tinha a própria rolagem. */}
          <AttachmentViewer
            receipt={receipt}
            ativo
            className="bg-slate-50 rounded border border-slate-200"
          />
        </CardContent>
      </Card>
    </div>
  );
}

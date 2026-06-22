import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CallMade from "~icons/material-symbols-light/call-made";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/AuthContext";
import { CostCenterChip } from "@/modules/cost-centers/ccIcons";
import type { Receipt, ReceiptItem } from "../types";
import { useCategories } from "../hooks/useCategories";
import { promoteReceiptItem } from "../hooks/useReceipts";
import { formatBRL, getCategoryLabel } from "../utils/receiptFormatters";

interface ReceiptItemsTableProps {
  receipt: Receipt;
  /** Chamado após desagrupar um item (pra refetch da lista). */
  onChanged?: () => void;
  /** Mostra a ação "desagrupar" por item (default true). */
  editable?: boolean;
}

/**
 * Tabela de itens (line items) de um lançamento + ação de "desagrupar"
 * (promote: converte um item num lançamento separado). Compartilhada pelo
 * ReceiptViewDialog e pelas páginas Notas e Recibos / Faturas.
 */
export function ReceiptItemsTable({
  receipt,
  onChanged,
  editable = true,
}: ReceiptItemsTableProps) {
  const { categories } = useCategories();
  const { user } = useAuth();
  const navigate = useNavigate();
  const ccById = new Map((user?.costCenters ?? []).map((c) => [c.id, c]));
  const [pendingPromote, setPendingPromote] = useState<ReceiptItem | null>(null);
  const [promoting, setPromoting] = useState(false);

  const items = receipt.items ?? [];
  const canPromote = (receipt.item_count ?? 0) >= 2;

  async function confirmPromote() {
    if (!pendingPromote) return;
    setPromoting(true);
    try {
      await promoteReceiptItem(receipt.id, pendingPromote.id);
      toast.success("Item convertido em lançamento.");
      setPendingPromote(null);
      onChanged?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível converter.",
      );
    } finally {
      setPromoting(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-md">
        <thead className="bg-slate-50 text-slate-600 text-xs">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Descrição</th>
            <th className="text-left px-3 py-2 font-medium">Categoria</th>
            <th className="text-left px-3 py-2 font-medium">Centro</th>
            <th className="text-right px-3 py-2 font-medium">Valor</th>
            {editable && <th className="px-3 py-2 w-9"></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const cc = it.cost_center_id ? ccById.get(it.cost_center_id) : null;
            // Item desmembrado: continua visível, porém esmaecido e fora do total.
            const promoted = !!it.promoted_to_receipt_id;
            return (
              <tr
                key={it.id}
                className={cn(
                  "border-t border-slate-100",
                  promoted && "bg-slate-50/60 text-slate-400",
                )}
              >
                <td className="px-3 py-2 text-slate-700">
                  <span className={promoted ? "text-slate-400" : undefined}>
                    {it.description || "—"}
                  </span>
                  {it.quantity != null && it.unit_value != null ? (
                    <span className="text-xs text-slate-400">
                      {" "}
                      ({it.quantity} × {formatBRL(it.unit_value)})
                    </span>
                  ) : null}
                  {promoted && (
                    <Badge
                      size="compact"
                      colorScheme="slate"
                      role="button"
                      tabIndex={0}
                      aria-label="Ver o lançamento que este item virou"
                      className="ml-2 align-middle cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
                      title="Ver o lançamento que este item virou"
                      onClick={() =>
                        navigate(`/lancamentos?open=${it.promoted_to_receipt_id}`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/lancamentos?open=${it.promoted_to_receipt_id}`);
                        }
                      }}
                    >
                      Desmembrado
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {getCategoryLabel(it.category, categories)}
                </td>
                <td className="px-3 py-2">
                  {cc ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CostCenterChip
                        icon={cc.icon}
                        color={cc.color}
                        className="size-5 shrink-0"
                      />
                      <span className="text-slate-600 truncate">{cc.name}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    promoted ? "text-slate-400 line-through" : "text-slate-900",
                  )}
                >
                  {formatBRL(it.total_value)}
                </td>
                {editable && (
                  <td className="px-3 py-2 text-right">
                    {!promoted && (
                      <ActionIconButton
                        icon={CallMade}
                        label="Converter em lançamento"
                        disabled={!canPromote}
                        onClick={() => setPendingPromote(it)}
                      />
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td className="px-3 py-2 font-medium text-slate-700" colSpan={3}>
              Total
            </td>
            <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">
              {formatBRL(receipt.total_value)}
            </td>
            {editable && <td></td>}
          </tr>
        </tfoot>
      </table>
      </div>

      <ConfirmActionDialog
        open={pendingPromote !== null}
        onOpenChange={(o) => {
          if (!o) setPendingPromote(null);
        }}
        title="Converter em Lançamento"
        description={
          pendingPromote
            ? `Converter "${pendingPromote.description || getCategoryLabel(pendingPromote.category, categories)}" (${formatBRL(pendingPromote.total_value)}) em um lançamento separado? Ele sai deste lançamento e o total é recalculado.`
            : ""
        }
        confirmLabel="Converter"
        cancelLabel="Cancelar"
        loading={promoting}
        loadingLabel="Convertendo..."
        onConfirm={confirmPromote}
      />
    </div>
  );
}

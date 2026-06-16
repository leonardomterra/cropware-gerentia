import ArrowDownLeft from "~icons/material-symbols-light/call-received";
import ArrowUpRight from "~icons/material-symbols-light/call-made";
import MoreVertical from "~icons/material-symbols-light/more-vert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import { Badge } from "@/components/ui/badge";
import type { Receipt } from "../types";
import { STATUS_COLOR_SCHEME, STATUS_LABEL } from "../constants";
import { useCategories } from "../hooks/useCategories";
import {
  formatBRL,
  formatDateBR,
  getCategoryLabel,
} from "../utils/receiptFormatters";

interface ReceiptsCardsProps {
  receipts: Receipt[];
  onView: (r: Receipt) => void;
  onEdit: (r: Receipt) => void;
  onDelete: (r: Receipt) => void;
}

export function ReceiptsCards({ receipts, onView, onEdit, onDelete }: ReceiptsCardsProps) {
  const { categories } = useCategories();
  return (
    <div className="flex flex-col gap-2">
      {receipts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-400">
          Nenhum lançamento neste mês.
        </div>
      ) : null}
      {receipts.map((r) => (
        <div
          key={r.id}
          className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3"
        >
          <div className="size-8 rounded-md bg-slate-50 flex items-center justify-center shrink-0">
            {r.direction === "income" ? (
              <ArrowDownLeft className="size-4 text-emerald-600" />
            ) : (
              <ArrowUpRight className="size-4 text-slate-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-900 truncate">
                {r.vendor ?? r.description ?? "(sem fornecedor)"}
              </p>
              <p
                className={cn(
                  "font-medium tabular-nums whitespace-nowrap text-sm",
                  r.is_estimated
                    ? "text-slate-400"
                    : r.direction === "income"
                      ? "text-emerald-700"
                      : "text-slate-900",
                )}
              >
                {r.is_estimated ? "~" : r.direction === "income" ? "+" : ""}
                {formatBRL(r.total_value)}
              </p>
            </div>
            <p className="text-sm text-slate-500 mt-0.5 truncate">
              {formatDateBR(r.transaction_date)}
              {(() => {
                const its = r.items ?? [];
                const hasItems = r.item_count > 0 && its.length > 0;
                if (hasItems) {
                  const uCats = [...new Set(its.map((i) => i.category))];
                  if (uCats.length > 1) return " - Vários";
                  return uCats[0]
                    ? ` - ${getCategoryLabel(uCats[0], categories)}`
                    : "";
                }
                return r.category
                  ? ` - ${getCategoryLabel(r.category, categories)}`
                  : "";
              })()}
            </p>
            <div className="mt-2">
              <Badge colorScheme={r.is_estimated ? "orange" : STATUS_COLOR_SCHEME[r.status]}>
                {r.is_estimated ? "Previsto" : STATUS_LABEL[r.status]}
              </Badge>
            </div>
          </div>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 -mt-1"
                aria-label="Ações"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onView(r)}>
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEdit(r)}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete(r)}
                className="text-red-600 focus:text-red-700 focus:bg-red-50"
              >
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}

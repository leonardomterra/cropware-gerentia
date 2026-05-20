import { ArrowDownLeft, ArrowUpRight, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import type { Receipt } from "../types";
import { STATUS_LABEL, STATUS_TONE } from "../constants";
import { formatBRL, formatDateBR } from "../utils/receiptFormatters";

interface ReceiptsCardsProps {
  receipts: Receipt[];
  onEdit: (r: Receipt) => void;
  onDelete: (r: Receipt) => void;
}

export function ReceiptsCards({ receipts, onEdit, onDelete }: ReceiptsCardsProps) {
  return (
    <div className="flex flex-col gap-2">
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
                  r.direction === "income"
                    ? "text-emerald-700"
                    : "text-slate-900",
                )}
              >
                {r.direction === "income" ? "+" : ""}
                {formatBRL(r.total_value)}
              </p>
            </div>
            <p className="text-sm text-slate-500 mt-0.5 truncate">
              {formatDateBR(r.transaction_date)}
              {r.category ? ` - ${r.category}` : ""}
            </p>
            <div className="mt-2">
              <span
                className={cn(
                  "inline-flex items-center text-[13px] px-2 py-0.5 rounded border font-medium",
                  STATUS_TONE[r.status],
                )}
              >
                {STATUS_LABEL[r.status]}
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 -mt-1"
                aria-label="Acoes"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

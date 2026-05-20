import { ArrowDownLeft, ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/components/ui/utils";
import type { Receipt } from "../types";
import { STATUS_LABEL, STATUS_TONE } from "../constants";
import { formatBRL, formatDateBR } from "../utils/receiptFormatters";

interface ReceiptsTableProps {
  receipts: Receipt[];
  onEdit: (r: Receipt) => void;
  onDelete: (r: Receipt) => void;
}

export function ReceiptsTable({ receipts, onEdit, onDelete }: ReceiptsTableProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="w-10"></TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Fornecedor / Descricao</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((r) => (
            <TableRow key={r.id} className="hover:bg-slate-50/60">
              <TableCell>
                {r.direction === "income" ? (
                  <ArrowDownLeft className="size-4 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="size-4 text-slate-500" />
                )}
              </TableCell>
              <TableCell className="text-slate-700 whitespace-nowrap">
                {formatDateBR(r.transaction_date)}
              </TableCell>
              <TableCell>
                <p className="font-medium text-slate-900 truncate max-w-[28ch]">
                  {r.vendor ?? r.description ?? "(sem fornecedor)"}
                </p>
                {r.vendor && r.description ? (
                  <p className="text-sm text-slate-500 truncate max-w-[40ch]">
                    {r.description}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="text-slate-600 capitalize">
                {r.category ?? "-"}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center text-[13px] px-2 py-0.5 rounded border font-medium",
                    STATUS_TONE[r.status],
                  )}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <span
                  className={
                    r.direction === "income"
                      ? "text-emerald-700"
                      : "text-slate-900"
                  }
                >
                  {r.direction === "income" ? "+" : ""}
                  {formatBRL(r.total_value)}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onEdit(r)}
                    aria-label="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete(r)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

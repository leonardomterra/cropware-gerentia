import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReceiptsPage() {
  return (
    <div className="max-w-4xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lancamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Despesas e receitas da fazenda.
          </p>
        </div>
        <Button variant="default" disabled>
          Capturar recibo
        </Button>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 p-12 flex flex-col items-center text-center gap-3">
        <Receipt className="size-10 text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-900">
            Nenhum lancamento ainda
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            A tabela de recibos + captura por foto chega no commit 9. Captura
            via WhatsApp logo depois.
          </p>
        </div>
      </div>
    </div>
  );
}

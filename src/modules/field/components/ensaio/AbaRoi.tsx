import { useState } from "react";
import { toast } from "sonner";
import DownloadSimple from "~icons/ph/download-simple";
import Printer from "~icons/ph/printer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA, ICONE_BOTAO_BARRA } from "@/lib/ui-tokens";
import {
  downloadReportCsv,
  openReportPage,
} from "@/modules/reports/reportExport";
import type { ReportDoc } from "@/modules/reports/reportBuilders";
import { Campo } from "../Cadastro";
import { roiDoEnsaio } from "../../dominio/ensaios";
import { tabelaDoRoi } from "../../dominio/relatorioDoEnsaio";
import { lerNumero, numeroParaCampo } from "../../utils/nomes";
import type { Resultado } from "../../hooks/useCadastros";
import type { ColheitaDoEnsaioRow, Ensaio, ProdutoNoEnsaio } from "../../types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sc = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * ROI do ensaio — custo TOTAL do produto (decisão de 16/11/2026, a conta da aba
 * ROI do Flag Field): ganho = (prod − prod_ref) × preço da saca; lucro =
 * ganho − custo; ROI = lucro ÷ custo. Uma fórmula só, a de dominio/ensaios.ts —
 * o relatório usa a mesma.
 */
export function AbaRoi({
  ensaio,
  produtos,
  colheitas,
  somenteLeitura,
  salvarEnsaio,
  salvarProduto,
}: {
  ensaio: Ensaio;
  produtos: ProdutoNoEnsaio[];
  colheitas: ColheitaDoEnsaioRow[];
  somenteLeitura: boolean;
  salvarEnsaio: (d: Record<string, unknown>) => Promise<Resultado>;
  salvarProduto: (d: Record<string, unknown>, id: string) => Promise<Resultado>;
}) {
  const [preco, setPreco] = useState(numeroParaCampo(ensaio.sack_price));
  const [custos, setCustos] = useState<Record<string, string>>(
    Object.fromEntries(produtos.map((p) => [p.id, numeroParaCampo(p.cost_ha)])),
  );
  const { referenciaId, linhas } = roiDoEnsaio(
    produtos,
    colheitas,
    ensaio.sack_price,
    ensaio.roi_reference_product_id,
  );

  async function salvarPreco() {
    const v = lerNumero(preco);
    if (v === ensaio.sack_price) return;
    const res = await salvarEnsaio({ sack_price: v && v > 0 ? v : null });
    if (!res.ok) toast.error(res.erro);
  }
  async function salvarCusto(id: string) {
    const v = lerNumero(custos[id] ?? "");
    if (v === produtos.find((p) => p.id === id)?.cost_ha) return;
    const res = await salvarProduto({ cost_ha: v }, id);
    if (!res.ok) toast.error(res.erro);
  }

  // A MESMA tabela do relatório completo do ensaio (dominio/relatorioDoEnsaio).
  function documento(): ReportDoc {
    return {
      title: `ROI do ensaio — ${ensaio.name}`,
      periodLabel: `${ensaio.crop} · saca ${ensaio.sack_price ? brl(ensaio.sack_price) : "—"}`,
      ccLabel: "",
      meta: [],
      tables: [
        {
          ...tabelaDoRoi(
            produtos,
            colheitas,
            ensaio.sack_price,
            ensaio.roi_reference_product_id,
          ),
          title: "Comparativo",
        },
      ],
    };
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Campo rotulo="Preço da saca (R$)">
          <Input
            inputMode="decimal"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            onBlur={() => void salvarPreco()}
            disabled={somenteLeitura}
            placeholder="0,00"
          />
        </Campo>
        <Campo
          rotulo="Produto de referência"
          ajuda="A base da comparação. Sem escolha, vale o 1º principal com colheita."
        >
          <Select
            value={ensaio.roi_reference_product_id ?? "auto"}
            onValueChange={async (v) => {
              const res = await salvarEnsaio({
                roi_reference_product_id: v === "auto" ? null : v,
              });
              if (!res.ok) toast.error(res.erro);
            }}
            disabled={somenteLeitura}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automático</SelectItem>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className={cn(BOTAO_BARRA, "rounded-md")}
            onClick={() =>
              downloadReportCsv(documento(), `roi-${ensaio.name}.csv`)
            }
          >
            <DownloadSimple className={ICONE_BOTAO_BARRA} />
            CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(BOTAO_BARRA, "rounded-md")}
            onClick={() =>
              void openReportPage(documento()).catch(() =>
                toast.error("Não foi possível abrir."),
              )
            }
          >
            <Printer className={ICONE_BOTAO_BARRA} />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left font-normal px-3 py-2">Produto</th>
              <th className="text-right font-normal px-3 py-2">Custo R$/ha</th>
              <th className="text-right font-normal px-3 py-2">
                Prod. (sc/ha)
              </th>
              <th className="text-right font-normal px-3 py-2">Ganho/ha</th>
              <th className="text-right font-normal px-3 py-2">Lucro/ha</th>
              <th className="text-right font-normal px-3 py-2">ROI</th>
              <th className="text-right font-normal px-3 py-2">Em sacas</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {linhas.map((l) => (
              <tr key={l.produto.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <span className="text-slate-900">{l.produto.name}</span>
                  <span className="block text-xs text-slate-400">
                    {l.produto.role === "principal"
                      ? "Principal"
                      : "Concorrente"}
                    {l.produto.id === referenciaId ? " · referência" : ""}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Input
                    inputMode="decimal"
                    value={custos[l.produto.id] ?? ""}
                    onChange={(e) =>
                      setCustos((s) => ({
                        ...s,
                        [l.produto.id]: e.target.value,
                      }))
                    }
                    onBlur={() => void salvarCusto(l.produto.id)}
                    disabled={somenteLeitura}
                    className="h-8 w-28 ml-auto text-right"
                    placeholder="0,00"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {l.produtividade != null ? sc(l.produtividade) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {l.ganho != null ? brl(l.ganho) : "—"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right",
                    l.lucro != null &&
                      (l.lucro >= 0 ? "text-emerald-700" : "text-red-700"),
                  )}
                >
                  {l.lucro != null ? brl(l.lucro) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {l.ehReferencia ? (
                    <span className="text-slate-400">Referência</span>
                  ) : l.roi != null ? (
                    `${l.roi.toLocaleString("pt-BR")}%`
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {l.custoEmSacas != null ? sc(l.custoEmSacas) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ensaio.sack_price && (
        <p className="text-sm text-slate-500">
          Informe o preço da saca para calcular ganho, lucro e ROI.
        </p>
      )}
    </div>
  );
}

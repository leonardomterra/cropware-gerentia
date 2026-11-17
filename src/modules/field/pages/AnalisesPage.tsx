import { useMemo, useState } from "react";
import { toast } from "sonner";
import ChartLineUp from "~icons/ph/chart-line-up-duotone";
import DownloadSimple from "~icons/ph/download-simple";
import Printer from "~icons/ph/printer";
import { Button } from "@/components/ui/button";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
import { useCadastros } from "../hooks/useCadastros";
import { useEnsaios } from "../hooks/useEnsaios";
import { TIPOS_DE_ENSAIO, analisar } from "../dominio/ensaios";

const sc = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Análises entre ensaios — o resultado que o DM leva para o cliente: ranking
 * dos produtos pela produtividade colhida e quanto o principal ganhou do
 * concorrente, ensaio a ensaio. Conta só a COLHEITA (como no Flag Field).
 */
export default function AnalisesPage() {
  const c = useCadastros();
  const d = useEnsaios();
  const [fFazenda, setFFazenda] = useState("todas");
  const [fCultura, setFCultura] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");
  const [fSafra, setFSafra] = useState("todas");
  const [fSituacao, setFSituacao] = useState("todos");

  const ensaios = useMemo(
    () =>
      d.ensaios.filter(
        (e) =>
          (fFazenda === "todas" || e.farm_id === fFazenda) &&
          (fCultura === "todas" || e.crop === fCultura) &&
          (fTipo === "todos" || e.trial_type === fTipo) &&
          (fSafra === "todas" || e.season_id === fSafra) &&
          (fSituacao === "todos" ||
            (fSituacao === "ativos"
              ? e.lifecycle === "active"
              : e.lifecycle === "completed")),
      ),
    [d.ensaios, fFazenda, fCultura, fTipo, fSafra, fSituacao],
  );
  const r = useMemo(
    () =>
      analisar(
        ensaios.map((e) => ({
          id: e.id,
          nome: `${e.crop} · ${e.name}`,
          produtos: d.produtos.filter((p) => p.trial_id === e.id),
          colheitas: d.colheitas.filter((h) => h.trial_id === e.id),
        })),
      ),
    [ensaios, d.produtos, d.colheitas],
  );
  const culturas = [...new Set(d.ensaios.map((e) => e.crop))].sort();
  const maior = Math.max(1, ...r.ranking.map((x) => x.media));

  function documento(): ReportDoc {
    return {
      title: "Análise de ensaios",
      periodLabel: `${ensaios.length} ensaios`,
      ccLabel: "",
      meta: r.resumo
        ? [
            {
              label: "Ganho médio do principal",
              value: `${sc(r.resumo.ganhoMedio)} sc/ha (${sc(r.resumo.percentual)}%)`,
            },
            {
              label: "Venceu",
              value: `${r.resumo.vitorias} de ${r.resumo.ensaios}`,
            },
          ]
        : [],
      tables: [
        {
          title: "Ranking de produtos",
          columns: [
            { label: "Produto" },
            { label: "Papel" },
            { label: "Média (sc/ha)", align: "right" },
            { label: "Mín.", align: "right" },
            { label: "Máx.", align: "right" },
            { label: "Ensaios", align: "right" },
          ],
          rows: r.ranking.map((x) => [
            x.nome,
            x.papel === "principal" ? "Principal" : "Concorrente",
            sc(x.media),
            sc(x.minima),
            sc(x.maxima),
            x.ensaios,
          ]),
        },
        {
          title: "Ganho por ensaio",
          columns: [
            { label: "Ensaio" },
            { label: "Principal (sc/ha)", align: "right" },
            { label: "Concorrente (sc/ha)", align: "right" },
            { label: "Diferença", align: "right" },
            { label: "%", align: "right" },
          ],
          rows: r.ganhos.map((g) => [
            g.nome,
            sc(g.principal),
            sc(g.concorrente),
            sc(g.diferenca),
            `${sc(g.percentual)}%`,
          ]),
        },
      ],
    };
  }

  return (
    <div className="space-y-4">
      <BarraDeTela
        campos={[
          {
            rotulo: "Fazenda",
            ativo: fFazenda !== "todas",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todas", label: "Todas as fazendas" },
                  ...c.fazendas.map((f) => ({ value: f.id, label: f.name })),
                ]}
                value={fFazenda}
                onValueChange={(v) => setFFazenda(v || "todas")}
              />
            ),
          },
          {
            rotulo: "Cultura",
            ativo: fCultura !== "todas",
            campo: (
              <Select value={fCultura} onValueChange={setFCultura}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as culturas</SelectItem>
                  {culturas.map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ),
          },
          {
            rotulo: "Safra",
            ativo: fSafra !== "todas",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todas", label: "Todas as safras" },
                  ...c.safras.map((s) => ({ value: s.id, label: s.name })),
                ]}
                value={fSafra}
                onValueChange={(v) => setFSafra(v || "todas")}
              />
            ),
          },
        ]}
        painel={
          <div className="space-y-3">
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="h-9 bg-white text-slate-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(TIPOS_DE_ENSAIO).map(([v, x]) => (
                  <SelectItem key={v} value={v}>
                    {x.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fSituacao} onValueChange={setFSituacao}>
              <SelectTrigger className="h-9 bg-white text-slate-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Ativos e concluídos</SelectItem>
                <SelectItem value="ativos">Só em condução</SelectItem>
                <SelectItem value="concluidos">Só concluídos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        filtrosAtivos={
          (fTipo !== "todos" ? 1 : 0) + (fSituacao !== "todos" ? 1 : 0)
        }
        acoes={
          <>
            <Button
              type="button"
              variant="ghost"
              className={cn(BOTAO_BARRA, "rounded-md")}
              disabled={r.ranking.length === 0}
              onClick={() =>
                downloadReportCsv(documento(), "analise-de-ensaios.csv")
              }
            >
              <DownloadSimple className={ICONE_BOTAO_BARRA} />
              CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(BOTAO_BARRA, "rounded-md")}
              disabled={r.ranking.length === 0}
              onClick={() =>
                void openReportPage(documento()).catch(() =>
                  toast.error("Não foi possível abrir."),
                )
              }
            >
              <Printer className={ICONE_BOTAO_BARRA} />
              Imprimir / PDF
            </Button>
          </>
        }
      />

      {d.carregando ? (
        <LoadingState />
      ) : r.ranking.length === 0 ? (
        <EmptyStateCard
          icon={ChartLineUp}
          title="Ainda sem colheitas para comparar"
          description="As análises usam a produtividade colhida dos ensaios. Registre a colheita dos produtos para ver o ranking e o ganho do principal."
        />
      ) : (
        <>
          {r.resumo && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Dado
                rotulo="Ganho médio do principal"
                valor={`${r.resumo.ganhoMedio >= 0 ? "+" : ""}${sc(r.resumo.ganhoMedio)} sc/ha`}
                detalhe={`${sc(r.resumo.percentual)}%`}
                tom={r.resumo.ganhoMedio >= 0 ? "bom" : "ruim"}
              />
              <Dado
                rotulo="Venceu"
                valor={`${r.resumo.vitorias} de ${r.resumo.ensaios}`}
                detalhe={`${Math.round((r.resumo.vitorias / r.resumo.ensaios) * 100)}% dos ensaios`}
              />
              <Dado rotulo="Empates" valor={String(r.resumo.empates)} />
              <Dado
                rotulo="Ensaios com os dois lados colhidos"
                valor={String(r.resumo.ensaios)}
              />
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
            <h2 className="text-sm font-medium text-slate-500">
              Ranking de produtos (produtividade média)
            </h2>
            {r.ranking.map((x, i) => (
              <div key={x.chave} className="space-y-1">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="w-5 text-slate-400 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-slate-800">
                    {x.nome}
                  </span>
                  <span className="text-xs text-slate-400">
                    {x.papel === "principal" ? "Principal" : "Concorrente"} ·{" "}
                    {x.ensaios} {x.ensaios === 1 ? "ensaio" : "ensaios"} ·{" "}
                    {sc(x.minima)}–{sc(x.maxima)}
                  </span>
                  <span className="tabular-nums font-medium text-slate-900">
                    {sc(x.media)} sc/ha
                  </span>
                </div>
                <div className="ml-7 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      x.papel === "principal" ? "bg-lime-600" : "bg-slate-400",
                    )}
                    style={{ width: `${(x.media / maior) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {r.ganhos.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-medium text-slate-500 mb-2">
                Ganho por ensaio
              </h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {r.ganhos.map((g) => (
                  <li
                    key={g.ensaioId}
                    className="flex flex-wrap items-center gap-2 py-2"
                  >
                    <span className="flex-1 min-w-0 truncate text-slate-800">
                      {g.nome}
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      {sc(g.principal)} × {sc(g.concorrente)} sc/ha
                    </span>
                    <span
                      className={cn(
                        "tabular-nums font-medium",
                        g.diferenca > 0
                          ? "text-emerald-700"
                          : g.diferenca < 0
                            ? "text-red-700"
                            : "text-slate-500",
                      )}
                    >
                      {g.diferenca > 0 ? "+" : ""}
                      {sc(g.diferenca)} ({sc(g.percentual)}%)
                    </span>
                    <span
                      className={cn(
                        "text-[11px] px-1.5 py-0.5 rounded border",
                        g.vencedor === "principal"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : g.vencedor === "concorrente"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-slate-50 text-slate-600 border-slate-200",
                      )}
                    >
                      {g.vencedor === "principal"
                        ? "Principal venceu"
                        : g.vencedor === "concorrente"
                          ? "Concorrente venceu"
                          : "Empate"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Dado({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "bom" | "ruim";
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p
        className={cn(
          "text-lg font-medium tabular-nums",
          tom === "bom"
            ? "text-emerald-700"
            : tom === "ruim"
              ? "text-red-700"
              : "text-slate-900",
        )}
      >
        {valor}
      </p>
      {detalhe && <p className="text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

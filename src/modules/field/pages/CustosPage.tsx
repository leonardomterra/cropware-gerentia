import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ChartBar from "~icons/ph/chart-bar-duotone";
import DownloadSimple from "~icons/ph/download-simple";
import Printer from "~icons/ph/printer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Ajuda } from "@/components/ui/Ajuda";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BOTAO_BARRA, ICONE_BOTAO_BARRA } from "@/lib/ui-tokens";
import { COR_OUTROS } from "@/lib/paleta";
import { cn } from "@/components/ui/utils";
import {
  downloadReportCsv,
  openReportPage,
} from "@/modules/reports/reportExport";
import type { ReportDoc } from "@/modules/reports/reportBuilders";
import { useAtividades, useCadastros } from "../hooks/useCadastros";
import { useLancamentosDoCampo } from "../hooks/useLancamentosDoCampo";
import { TIPOS } from "../dominio/atividades";
import { dentroDaJanela } from "../dominio/custo";
import { montarCustosPorTalhao, porHa } from "../dominio/relatorioDeCustos";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ha = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const hojeIso = () => new Date().toISOString().slice(0, 10);

/**
 * Custo por talhão — o agronômico (o que as atividades dizem) ao lado do
 * realizado (o que foi lançado no financeiro). É a razão de o Field morar no
 * gerentia. Regras em dominio/relatorioDeCustos.ts e dominio/custo.ts.
 */
export default function CustosPage() {
  const c = useCadastros();
  const a = useAtividades();
  const l = useLancamentosDoCampo();
  const [safraId, setSafraId] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [farmId, setFarmId] = useState("todas");

  // Começa na safra vigente (ou na mais recente).
  useEffect(() => {
    if (safraId || c.safras.length === 0) return;
    setSafraId(
      c.safras.find((s) => dentroDaJanela(hojeIso(), s))?.id ?? c.safras[0].id,
    );
  }, [c.safras, safraId]);

  const safra = c.safras.find((s) => s.id === safraId) ?? null;
  const porPeriodo = safraId === "periodo";
  const janela = porPeriodo
    ? de && ate
      ? { starts_on: de, ends_on: ate }
      : null
    : safra
      ? { starts_on: safra.starts_on, ends_on: safra.ends_on }
      : null;

  const plantioPorId = useMemo(
    () => new Map(c.plantios.map((p) => [p.id, p])),
    [c.plantios],
  );
  const fazendaPorId = useMemo(
    () => new Map(c.fazendas.map((f) => [f.id, f])),
    [c.fazendas],
  );

  const r = useMemo(() => {
    if (!janela) return null;
    return montarCustosPorTalhao(
      c.talhoes,
      a.atividades,
      l.lancamentos,
      (pid) => plantioPorId.get(pid)?.season_id ?? null,
      c.safras,
      {
        janela,
        safraId: porPeriodo ? null : safraId,
        farmId: farmId === "todas" ? null : farmId,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    c.talhoes,
    a.atividades,
    l.lancamentos,
    plantioPorId,
    c.safras,
    janela?.starts_on,
    janela?.ends_on,
    safraId,
    farmId,
    porPeriodo,
  ]);

  const titulo = porPeriodo ? "Período" : (safra?.name ?? "");
  const periodoLabel = janela
    ? `${dataBr(janela.starts_on)} a ${dataBr(janela.ends_on)}`
    : "";
  const fazendaLabel =
    farmId === "todas"
      ? "Todas as fazendas"
      : (fazendaPorId.get(farmId)?.name ?? "");

  function documento(): ReportDoc | null {
    if (!r) return null;
    return {
      title: `Custo por talhão — ${titulo}`,
      periodLabel: periodoLabel,
      ccLabel: fazendaLabel,
      meta: [
        { label: "Área", value: `${ha(r.area)} ha` },
        {
          label: "Custo agronômico",
          value: `${brl(r.agronomico)} (${brl(porHa(r.agronomico, r.area))}/ha)`,
        },
        {
          label: "Custo realizado",
          value: `${brl(r.realizado)} (${brl(porHa(r.realizado, r.area))}/ha)`,
          tone: "out",
        },
      ],
      tables: [
        {
          title: "Por talhão",
          columns: [
            { label: "Fazenda" },
            { label: "Talhão" },
            { label: "Área (ha)", align: "right" },
            { label: "Agronômico", money: true },
            { label: "Agro R$/ha", money: true },
            { label: "Realizado", money: true },
            { label: "Real R$/ha", money: true },
            { label: "Diferença", money: true },
          ],
          rows: r.linhas.map((x) => [
            fazendaPorId.get(x.talhao.farm_id)?.name ?? "",
            x.talhao.name,
            ha(x.talhao.area_ha),
            x.agronomico,
            porHa(x.agronomico, x.talhao.area_ha),
            x.realizado,
            porHa(x.realizado, x.talhao.area_ha),
            x.realizado - x.agronomico,
          ]),
          total: [
            "Total",
            "",
            ha(r.area),
            r.agronomico,
            porHa(r.agronomico, r.area),
            r.realizado,
            porHa(r.realizado, r.area),
            r.realizado - r.agronomico,
          ],
          chart: {
            tipo: "barras",
            series: [
              { nome: "Agronômico", cor: "#65a30d" },
              { nome: "Realizado", cor: "#475569" },
            ],
            grupos: r.linhas.map((x) => ({
              rotulo: x.talhao.name,
              valores: [x.agronomico, x.realizado],
            })),
          },
        },
        {
          title: "Custo agronômico por tipo de atividade",
          columns: [
            { label: "Tipo" },
            { label: "Atividades", align: "right" },
            { label: "Valor", money: true },
          ],
          rows: r.porTipo.map((x) => [
            TIPOS[x.tipo].rotulo,
            x.quantidade,
            x.valor,
          ]),
        },
        ...(r.soDaFazenda.length
          ? [
              {
                title: "Lançamentos só da fazenda (sem talhão)",
                columns: [
                  { label: "Fazenda" },
                  { label: "Lançamentos", align: "right" as const },
                  { label: "Valor", money: true },
                ],
                rows: r.soDaFazenda.map((x) => [
                  fazendaPorId.get(x.farm_id)?.name ?? "",
                  x.quantidade,
                  x.valor,
                ]),
              },
            ]
          : []),
      ],
      empty: r.linhas.length === 0,
    };
  }

  const carregando = c.carregando || a.carregando || l.carregando;

  return (
    <div className="space-y-4">
      <BarraDeTela
        campos={[
          {
            rotulo: "Safra",
            campo: (
              <SearchableSelect
                options={[
                  ...c.safras.map((s) => ({ value: s.id, label: s.name })),
                  { value: "periodo", label: "Período livre..." },
                ]}
                value={safraId}
                onValueChange={(v) => setSafraId(v)}
                placeholder="Escolha a safra"
              />
            ),
          },
          {
            rotulo: "Fazenda",
            ativo: farmId !== "todas",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todas", label: "Todas as fazendas" },
                  ...c.fazendas.map((f) => ({ value: f.id, label: f.name })),
                ]}
                value={farmId}
                onValueChange={(v) => setFarmId(v || "todas")}
              />
            ),
          },
        ]}
        acoes={
          <>
            <Button
              type="button"
              variant="ghost"
              className={cn(BOTAO_BARRA, "rounded-md")}
              disabled={!r}
              onClick={() => {
                const d = documento();
                if (d)
                  downloadReportCsv(
                    d,
                    `custo-por-talhao-${titulo || "periodo"}.csv`,
                  );
              }}
            >
              <DownloadSimple className={ICONE_BOTAO_BARRA} />
              CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(BOTAO_BARRA, "rounded-md")}
              disabled={!r}
              onClick={() => {
                const d = documento();
                if (d)
                  void openReportPage(d).catch(() =>
                    toast.error("Não foi possível abrir o relatório."),
                  );
              }}
            >
              <Printer className={ICONE_BOTAO_BARRA} />
              Imprimir / PDF
            </Button>
          </>
        }
      />

      {porPeriodo && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">De</span>
          <Input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className="w-40"
          />
          <span className="text-slate-600">até</span>
          <Input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="w-40"
          />
        </div>
      )}

      {carregando ? (
        <LoadingState />
      ) : c.talhoes.length === 0 ? (
        <EmptyStateCard
          icon={ChartBar}
          title="Sem talhões ainda"
          description="Cadastre fazendas e talhões, registre atividades e ligue os lançamentos aos talhões para ver o custo de cada um."
        />
      ) : !r ? (
        <EmptyStateCard
          icon={ChartBar}
          title={
            c.safras.length
              ? "Escolha a safra ou o período"
              : "Cadastre uma safra"
          }
          description="O custo por talhão é visto dentro de uma safra (Field → Safras) ou de um período de datas."
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {titulo} · {periodoLabel} · {fazendaLabel}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi rotulo="Área" valor={`${ha(r.area)} ha`} />
            <Kpi
              rotulo="Custo agronômico"
              valor={brl(r.agronomico)}
              detalhe={`${brl(porHa(r.agronomico, r.area))}/ha`}
              ajuda="Soma do custo das atividades realizadas (insumo × dose × área). É uma estimativa feita a partir do que foi registrado no campo."
            />
            <Kpi
              rotulo="Custo realizado"
              valor={brl(r.realizado)}
              detalhe={`${brl(porHa(r.realizado, r.area))}/ha`}
              ajuda="Despesas lançadas no financeiro e ligadas a cada talhão, pela data, dentro do período. Compras no cartão ligadas ao talhão contam; a fatura não, para não contar duas vezes."
            />
            <Kpi
              rotulo="Só da fazenda"
              valor={brl(r.soDaFazenda.reduce((s, x) => s + x.valor, 0))}
              detalhe="sem talhão, fora do R$/ha"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-normal px-3 py-2">Talhão</th>
                  <th className="text-right font-normal px-3 py-2">Área</th>
                  <th className="text-right font-normal px-3 py-2">
                    Agronômico
                  </th>
                  <th className="text-right font-normal px-3 py-2">R$/ha</th>
                  <th className="text-right font-normal px-3 py-2">
                    Realizado
                  </th>
                  <th className="text-right font-normal px-3 py-2">R$/ha</th>
                  <th className="text-right font-normal px-3 py-2">
                    Diferença
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {r.linhas.map((x) => {
                  const dif = x.realizado - x.agronomico;
                  return (
                    <tr key={x.talhao.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <span className="text-slate-900">{x.talhao.name}</span>
                        <span className="block text-xs text-slate-400">
                          {fazendaPorId.get(x.talhao.farm_id)?.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {ha(x.talhao.area_ha)} ha
                      </td>
                      <td className="px-3 py-2 text-right">
                        {brl(x.agronomico)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {brl(porHa(x.agronomico, x.talhao.area_ha))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {brl(x.realizado)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {brl(porHa(x.realizado, x.talhao.area_ha))}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right",
                          dif > 0
                            ? "text-red-700"
                            : dif < 0
                              ? "text-emerald-700"
                              : "text-slate-400",
                        )}
                      >
                        {brl(dif)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="tabular-nums border-t border-slate-200 bg-slate-50 font-medium">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{ha(r.area)} ha</td>
                  <td className="px-3 py-2 text-right">{brl(r.agronomico)}</td>
                  <td className="px-3 py-2 text-right">
                    {brl(porHa(r.agronomico, r.area))}
                  </td>
                  <td className="px-3 py-2 text-right">{brl(r.realizado)}</td>
                  <td className="px-3 py-2 text-right">
                    {brl(porHa(r.realizado, r.area))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {brl(r.realizado - r.agronomico)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ListaSimples
              titulo="Custo agronômico por tipo"
              vazio="Nenhuma atividade com custo no período."
              itens={r.porTipo.map((x) => ({
                rotulo: `${TIPOS[x.tipo].rotulo} (${x.quantidade})`,
                valor: x.valor,
                cor: TIPOS[x.tipo].cor,
              }))}
            />
            <ListaSimples
              titulo="Lançamentos só da fazenda (sem talhão)"
              vazio="Nenhum lançamento ligado só à fazenda no período."
              itens={r.soDaFazenda.map((x) => ({
                rotulo: `${fazendaPorId.get(x.farm_id)?.name ?? "—"} (${x.quantidade})`,
                valor: x.valor,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  rotulo,
  valor,
  detalhe,
  ajuda,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  ajuda?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-sm text-slate-500">
        {rotulo}
        {ajuda && <Ajuda>{ajuda}</Ajuda>}
      </p>
      <p className="text-lg font-medium text-slate-900 tabular-nums">{valor}</p>
      {detalhe && (
        <p className="text-xs text-slate-500 tabular-nums">{detalhe}</p>
      )}
    </div>
  );
}

function ListaSimples({
  titulo,
  itens,
  vazio,
}: {
  titulo: string;
  itens: { rotulo: string; valor: number; cor?: string }[];
  vazio: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
      <h3 className="text-sm font-medium text-slate-900">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">{vazio}</p>
      ) : (
        itens.map((i) => (
          <div key={i.rotulo} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{i.rotulo}</span>
              <span className="tabular-nums text-slate-900">
                {brl(i.valor)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(i.valor / max) * 100}%`,
                  backgroundColor: i.cor ?? COR_OUTROS,
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

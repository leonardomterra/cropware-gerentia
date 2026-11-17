import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import CaretLeft from "~icons/ph/caret-left";
import CaretRight from "~icons/ph/caret-right";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA } from "@/lib/ui-tokens";
import { useIsMobile } from "@/components/ui/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { modulosVisiveis } from "@/lib/modulos";
import { useTasks } from "@/modules/tasks/hooks/useTasks";
import { useReceipts } from "@/modules/receipts/hooks/useReceipts";
import { useEnsaios } from "@/modules/field/hooks/useEnsaios";
import {
  useAtividades,
  useCadastros,
} from "@/modules/field/hooks/useCadastros";
import { TIPOS } from "@/modules/field/dominio/atividades";
import { identidadeDoPlantio } from "@/modules/field/dominio/plantios";
import {
  CATEGORIAS,
  ROTULO_DA_SITUACAO,
  filtrar,
  montarItens,
  type AtividadeIn,
  type Categoria,
  type EnsaioIn,
  type ItemDoCalendario,
  type PlantioIn,
} from "./itens";

const hojeIso = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

interface DadosDoCampo {
  atividades: AtividadeIn[];
  plantios: PlantioIn[];
  ensaios: EnsaioIn[];
  fazendas: { id: string; name: string }[];
  carregando: boolean;
}

/**
 * Calendário único — pendências, contas a pagar/receber e, com o módulo Field,
 * atividades, plantios e colheitas. Fase 3 da unificação.
 *
 * Quem não tem o Field não carrega nada do campo: a tela decide antes de
 * montar os hooks dele (hook não pode ser condicional, componente pode).
 */
export default function CalendarioPage() {
  const { user, isMaster } = useAuth();
  const comCampo = modulosVisiveis(user?.modules, isMaster).includes("field");
  return comCampo ? <ComCampo /> : <Calendario campo={null} />;
}

function ComCampo() {
  const c = useCadastros();
  const a = useAtividades();
  const en = useEnsaios();
  const campo = useMemo<DadosDoCampo>(() => {
    const talhao = new Map(c.talhoes.map((t) => [t.id, t]));
    const fazenda = new Map(c.fazendas.map((f) => [f.id, f.name]));
    const onde = (plotId: string | null, farmId: string | null) =>
      [
        plotId ? talhao.get(plotId)?.name : null,
        farmId ? fazenda.get(farmId) : null,
      ]
        .filter(Boolean)
        .join(" · ");
    return {
      atividades: a.atividades.map((x) => ({
        id: x.id,
        date: x.date,
        status: x.status,
        rotuloDoTipo: TIPOS[x.type].rotulo,
        onde: onde(x.plot_id, x.farm_id),
        farm_id: x.farm_id,
      })),
      plantios: c.plantios.map((p) => {
        const farmId = talhao.get(p.plot_id)?.farm_id ?? null;
        return {
          id: p.id,
          nome: identidadeDoPlantio(p),
          onde: onde(p.plot_id, farmId),
          farm_id: farmId,
          planting_date: p.planting_date,
          expected_harvest_date: p.expected_harvest_date,
          lifecycle: p.lifecycle,
        };
      }),
      ensaios: en.ensaios.map((e) => ({
        id: e.id,
        nome: `${e.crop} · ${e.name}`,
        farm_id: e.farm_id,
        implantation_date: e.implantation_date,
        datasDeAvaliacao: en.avaliacoes
          .filter((v) => v.trial_id === e.id)
          .map((v) => v.date),
      })),
      fazendas: c.fazendas.map((f) => ({ id: f.id, name: f.name })),
      carregando: c.carregando || a.carregando || en.carregando,
    };
  }, [
    c.talhoes,
    c.fazendas,
    c.plantios,
    c.carregando,
    a.atividades,
    a.carregando,
    en.ensaios,
    en.avaliacoes,
    en.carregando,
  ]);
  return <Calendario campo={campo} />;
}

function Calendario({ campo }: { campo: DadosDoCampo | null }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { tasks, loading: carregandoTarefas } = useTasks();
  const { receipts, loading: carregandoContas } = useReceipts({
    status: ["a_pagar", "a_receber", "vencido"],
  });
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [visao, setVisao] = useState<"mes" | "lista">("mes");
  const [ligadas, setLigadas] = useState<Set<Categoria>>(new Set());
  const [farmId, setFarmId] = useState("");
  const [aberto, setAberto] = useState<ItemDoCalendario | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const hoje = hojeIso();

  const todos = useMemo(
    () =>
      montarItens(
        {
          pendencias: tasks,
          lancamentos: receipts.map((r) => ({
            id: r.id,
            due_date: r.due_date ?? null,
            direction: r.direction,
            status: r.status,
            vendor: r.vendor ?? null,
            description: r.description ?? null,
            total_value: Number(r.total_value),
            farm_id: r.farm_id ?? null,
          })),
          atividades: campo?.atividades ?? [],
          plantios: campo?.plantios ?? [],
          ensaios: campo?.ensaios ?? [],
        },
        hoje,
      ),
    [tasks, receipts, campo, hoje],
  );

  const inicio = format(startOfMonth(mes), "yyyy-MM-dd");
  const fim = format(endOfMonth(mes), "yyyy-MM-dd");
  const doMes = todos.filter((i) => i.data >= inicio && i.data <= fim);
  const visiveis = filtrar(doMes, ligadas, farmId || null);
  const porDia = useMemo(() => {
    const m = new Map<string, ItemDoCalendario[]>();
    for (const i of visiveis) m.set(i.data, [...(m.get(i.data) ?? []), i]);
    return m;
  }, [visiveis]);

  const categoriasDisponiveis = (Object.keys(CATEGORIAS) as Categoria[]).filter(
    (k) => campo || (k !== "atividade" && k !== "plantio" && k !== "ensaio"),
  );
  const carregando =
    carregandoTarefas || carregandoContas || !!campo?.carregando;
  const lista = isMobile || visao === "lista";

  const alternar = (k: Categoria) =>
    setLigadas((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const pilula = (i: ItemDoCalendario, compacta: boolean) => (
    <button
      key={i.id}
      type="button"
      onClick={() => setAberto(i)}
      className={cn(
        "w-full text-left flex items-center gap-1.5 rounded px-1.5 hover:bg-slate-100 min-w-0",
        compacta ? "py-0.5 text-xs" : "py-1.5 text-sm",
        i.situacao === "feito" && "opacity-60",
      )}
    >
      <span
        className="size-2 rounded-full shrink-0"
        style={{ backgroundColor: CATEGORIAS[i.categoria].cor }}
      />
      {i.hora && <span className="text-slate-400 tabular-nums">{i.hora}</span>}
      <span
        className={cn(
          "truncate",
          i.situacao === "atrasado" ? "text-red-700" : "text-slate-700",
          i.situacao === "feito" && "line-through",
        )}
      >
        {i.titulo}
      </span>
      {!compacta && i.detalhe && (
        <span className="ml-auto text-xs text-slate-400 truncate">
          {i.detalhe}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Navegação + visão */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(BOTAO_BARRA, "rounded-md px-2")}
          aria-label="Mês anterior"
          onClick={() => setMes((m) => addMonths(m, -1))}
        >
          <CaretLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(BOTAO_BARRA, "rounded-md")}
          onClick={() => setMes(startOfMonth(new Date()))}
        >
          Hoje
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(BOTAO_BARRA, "rounded-md px-2")}
          aria-label="Próximo mês"
          onClick={() => setMes((m) => addMonths(m, 1))}
        >
          <CaretRight className="size-4" />
        </Button>
        <h2 className="text-base font-medium text-slate-900 capitalize ml-1">
          {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        {!isMobile && (
          <div className="ml-auto flex rounded-md bg-slate-100 p-0.5 text-sm">
            {(["mes", "lista"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisao(v)}
                className={cn(
                  "px-3 h-8 rounded",
                  visao === v
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-600",
                )}
              >
                {v === "mes" ? "Mês" : "Lista"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legenda que também filtra */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categoriasDisponiveis.map((k) => {
          const n = filtrar(doMes, new Set([k]), farmId || null).length;
          const ativo = ligadas.size === 0 || ligadas.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => alternar(k)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-sm transition-colors",
                ativo
                  ? "border-slate-300 bg-white text-slate-700"
                  : "border-slate-200 text-slate-400",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor: ativo ? CATEGORIAS[k].cor : "#cbd5e1",
                }}
              />
              {CATEGORIAS[k].rotulo}
              <span className="text-xs text-slate-400 tabular-nums">{n}</span>
            </button>
          );
        })}
        {campo && campo.fazendas.length > 0 && (
          <div className="w-56 ml-auto">
            <SearchableSelect
              options={[
                { value: "", label: "Todas as fazendas" },
                ...campo.fazendas.map((f) => ({ value: f.id, label: f.name })),
              ]}
              value={farmId}
              onValueChange={setFarmId}
              searchPlaceholder="Buscar fazenda..."
            />
          </div>
        )}
      </div>

      {carregando ? (
        <LoadingState />
      ) : lista ? (
        <div className="space-y-3">
          {[...porDia.keys()].sort().map((dia) => (
            <div
              key={dia}
              className="rounded-lg border border-slate-200 bg-white p-2"
            >
              <p
                className={cn(
                  "text-xs font-medium uppercase tracking-wide px-1.5 pb-1",
                  dia === hoje ? "text-emerald-700" : "text-slate-400",
                )}
              >
                {format(new Date(`${dia}T12:00:00`), "EEEE, d 'de' MMM", {
                  locale: ptBR,
                })}
                {dia === hoje ? " · hoje" : ""}
              </p>
              {porDia.get(dia)!.map((i) => pilula(i, false))}
            </div>
          ))}
          {porDia.size === 0 && (
            <p className="text-sm text-slate-500 text-center py-10">
              Nada neste mês.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 text-xs text-slate-500">
            {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
              <div key={d} className="px-2 py-1.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {eachDayOfInterval({
              start: startOfWeek(startOfMonth(mes)),
              end: endOfWeek(endOfMonth(mes)),
            }).map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const doDia = porDia.get(iso) ?? [];
              const foraDoMes = iso < inicio || iso > fim;
              return (
                <div
                  key={iso}
                  className={cn(
                    "min-h-[6.5rem] border-t border-l border-slate-100 p-1 space-y-0.5",
                    foraDoMes && "bg-slate-50/60",
                  )}
                >
                  <div
                    className={cn(
                      "text-xs px-1",
                      iso === hoje
                        ? "inline-flex items-center justify-center size-5 rounded-full bg-slate-900 text-white"
                        : foraDoMes
                          ? "text-slate-300"
                          : "text-slate-500",
                    )}
                  >
                    {format(d, "d")}
                  </div>
                  {doDia.slice(0, 3).map((i) => pilula(i, true))}
                  {doDia.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setDiaAberto(iso)}
                      className="text-xs text-slate-500 hover:text-slate-900 px-1.5"
                    >
                      +{doDia.length - 3} mais
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detalhe de um item */}
      <Dialog
        open={aberto !== null}
        onOpenChange={(o) => !o && setAberto(null)}
      >
        <DialogContent className="max-w-sm">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor: CATEGORIAS[aberto.categoria].cor,
                    }}
                  />
                  {aberto.titulo}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-1 text-sm text-slate-600">
                <p>
                  {CATEGORIAS[aberto.categoria].rotulo} · {dataBr(aberto.data)}
                  {aberto.hora ? ` às ${aberto.hora}` : ""}
                </p>
                {aberto.detalhe && <p>{aberto.detalhe}</p>}
                <p
                  className={cn(
                    aberto.situacao === "atrasado"
                      ? "text-red-700 font-medium"
                      : "text-slate-500",
                  )}
                >
                  {ROTULO_DA_SITUACAO[aberto.situacao]}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate(aberto.destino)}
                className="w-full"
              >
                Abrir
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Todos os itens de um dia cheio */}
      <Dialog
        open={diaAberto !== null}
        onOpenChange={(o) => !o && setDiaAberto(null)}
      >
        <DialogContent className="max-w-md">
          {diaAberto && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(
                    new Date(`${diaAberto}T12:00:00`),
                    "EEEE, d 'de' MMMM",
                    {
                      locale: ptBR,
                    },
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-0.5">
                {(porDia.get(diaAberto) ?? []).map((i) => (
                  <div key={i.id} onClickCapture={() => setDiaAberto(null)}>
                    {pilula(i, false)}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

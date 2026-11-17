import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAtividades, useCadastros } from "../hooks/useCadastros";
import { useLancamentosDoCampo } from "../hooks/useLancamentosDoCampo";
import { TIPOS } from "../dominio/atividades";
import { identidadeDoPlantio } from "../dominio/plantios";
import { areaDoPlantio, dentroDaJanela } from "../dominio/custo";
import { montarCustosPorTalhao, porHa } from "../dominio/relatorioDeCustos";
import { somarDias } from "@/modules/tasks/agrupar";
import { cn } from "@/components/ui/utils";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const ha = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const diaMes = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const hojeIso = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/**
 * O campo no Dashboard (fase 3 da unificação). Componente à parte para não
 * inchar o Dashboard e porque carrega os próprios dados — só é montado quando o
 * módulo Field está visível (quem decide é o Dashboard).
 */
export function BlocoDoCampoNoDashboard() {
  const c = useCadastros();
  const a = useAtividades();
  const l = useLancamentosDoCampo();
  const hoje = hojeIso();

  const dados = useMemo(() => {
    const talhao = new Map(c.talhoes.map((t) => [t.id, t]));
    const ativos = c.plantios.filter((p) => p.lifecycle === "active");
    const areaAtiva = ativos.reduce(
      (s, p) => s + areaDoPlantio(p, talhao.get(p.plot_id)?.area_ha ?? 0),
      0,
    );
    const planejadas = a.atividades.filter((x) => x.status === "planejada");
    const atrasadas = planejadas.filter((x) => x.date < hoje);
    const proximas = planejadas
      .filter((x) => x.date >= hoje && x.date <= somarDias(hoje, 14))
      .sort((x, y) => x.date.localeCompare(y.date));
    const colheitas = c.plantios
      .filter(
        (p) =>
          p.lifecycle !== "completed" &&
          p.expected_harvest_date &&
          p.expected_harvest_date >= hoje &&
          p.expected_harvest_date <= somarDias(hoje, 30),
      )
      .sort((x, y) =>
        x.expected_harvest_date!.localeCompare(y.expected_harvest_date!),
      );
    const safra = c.safras.find((s) => dentroDaJanela(hoje, s)) ?? null;
    const plantioPorId = new Map(c.plantios.map((p) => [p.id, p]));
    const custo = safra
      ? montarCustosPorTalhao(
          c.talhoes,
          a.atividades,
          l.lancamentos,
          (pid) => plantioPorId.get(pid)?.season_id ?? null,
          c.safras,
          { janela: safra, safraId: safra.id, farmId: null },
        )
      : null;
    return {
      talhao,
      ativos,
      areaAtiva,
      atrasadas,
      proximas,
      colheitas,
      safra,
      custo,
    };
  }, [c.talhoes, c.plantios, c.safras, a.atividades, l.lancamentos, hoje]);

  if (c.carregando || a.carregando) return null;
  // Nada cadastrado ainda: o bloco não tem o que dizer.
  if (c.talhoes.length === 0) return null;

  const nomeDoTalhao = (id: string | null) =>
    id ? dados.talhao.get(id)?.name : null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-500">Campo</h2>
        <Link
          to="/calendario"
          className="text-xs text-slate-500 hover:text-slate-900"
        >
          Ver calendário →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Numero
          rotulo="Plantios em andamento"
          valor={String(dados.ativos.length)}
          detalhe={`${ha(dados.areaAtiva)} ha`}
          link="/campo/plantios"
        />
        <Numero
          rotulo="Atividades planejadas"
          valor={String(dados.proximas.length)}
          detalhe={
            dados.atrasadas.length
              ? `${dados.atrasadas.length} atrasada${dados.atrasadas.length > 1 ? "s" : ""}`
              : "próximos 14 dias"
          }
          alerta={dados.atrasadas.length > 0}
          link="/campo/atividades"
        />
        <Numero
          rotulo="Colheitas previstas"
          valor={String(dados.colheitas.length)}
          detalhe="próximos 30 dias"
          link="/campo/plantios"
        />
        <Numero
          rotulo={
            dados.safra ? `Custo · ${dados.safra.name}` : "Custo da safra"
          }
          valor={dados.custo ? brl(dados.custo.realizado) : "—"}
          detalhe={
            dados.custo
              ? `agronômico ${brl(dados.custo.agronomico)} · ${brl(
                  porHa(dados.custo.realizado, dados.custo.area),
                )}/ha`
              : "cadastre a safra vigente"
          }
          link={dados.safra ? "/campo/custos" : "/campo/safras"}
        />
      </div>

      {(dados.proximas.length > 0 ||
        dados.atrasadas.length > 0 ||
        dados.colheitas.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ul className="divide-y divide-slate-100 text-sm">
            {[...dados.atrasadas, ...dados.proximas].slice(0, 5).map((x) => (
              <li key={x.id}>
                <Link
                  to={`/campo/atividades?abrir=${x.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-slate-50 -mx-2 px-2 rounded"
                >
                  <span
                    className={cn(
                      "w-12 shrink-0 tabular-nums",
                      x.date < hoje ? "text-red-600" : "text-slate-500",
                    )}
                  >
                    {diaMes(x.date)}
                  </span>
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: TIPOS[x.type].cor }}
                  />
                  <span className="truncate text-slate-700">
                    {TIPOS[x.type].rotulo}
                    {nomeDoTalhao(x.plot_id)
                      ? ` · ${nomeDoTalhao(x.plot_id)}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-slate-100 text-sm">
            {dados.colheitas.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link
                  to={`/campo/plantios?abrir=${p.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-slate-50 -mx-2 px-2 rounded"
                >
                  <span className="w-12 shrink-0 tabular-nums text-slate-500">
                    {diaMes(p.expected_harvest_date!)}
                  </span>
                  <span className="truncate text-slate-700">
                    Colheita · {identidadeDoPlantio(p)} ·{" "}
                    {nomeDoTalhao(p.plot_id)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  detalhe,
  link,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  link: string;
  alerta?: boolean;
}) {
  return (
    <Link
      to={link}
      className="rounded-lg border border-slate-100 p-3 hover:border-slate-300 transition-colors"
    >
      <p className="text-xs text-slate-500 truncate">{rotulo}</p>
      <p className="text-lg font-medium text-slate-900 tabular-nums">{valor}</p>
      <p
        className={cn(
          "text-xs truncate",
          alerta ? "text-red-600" : "text-slate-500",
        )}
      >
        {detalhe}
      </p>
    </Link>
  );
}

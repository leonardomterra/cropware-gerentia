import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/components/ui/utils";
import { useAtividades, useCadastros } from "../hooks/useCadastros";
import { useEnsaios } from "../hooks/useEnsaios";
import { useLancamentosDoCampo } from "../hooks/useLancamentosDoCampo";
import { localDaFazenda, useClima, type Clima } from "../hooks/useClima";
import { ResumoDoClima } from "../components/ClimaDoCampo";
import { TIPOS } from "../dominio/atividades";
import { TIPOS_DE_ENSAIO } from "../dominio/ensaios";
import { identidadeDoPlantio } from "../dominio/plantios";
import {
  ITENS_POR_COLUNA,
  montarDashboardDoCampo,
  type DashboardDoCampo,
} from "../dominio/dashboardDoCampo";
import type { Fazenda } from "../types";

/**
 * Dashboard do Field (17/11/2026). Com o módulo Field ativo, o "Dashboard" do
 * menu abre esta tela no lugar do financeiro (quem escolhe é a DashboardPage).
 *
 * No molde do dashboard do Flag Field: números do topo, clima da fazenda e
 * três colunas — próximas colheitas, próximas atividades e últimas
 * avaliações. A montagem dos dados é pura (dominio/dashboardDoCampo.ts) e a
 * vista recebe tudo pronto, para poder ser conferida com dados de exemplo.
 */
export default function DashboardDoCampoPage() {
  const c = useCadastros();
  const a = useAtividades();
  const en = useEnsaios();
  const l = useLancamentosDoCampo();
  const hoje = hojeIso();

  const dados = useMemo(
    () =>
      montarDashboardDoCampo(
        {
          fazendas: c.fazendas,
          talhoes: c.talhoes,
          plantios: c.plantios,
          safras: c.safras,
          atividades: a.atividades,
          ensaios: en.ensaios,
          produtosDosEnsaios: en.produtos,
          etapas: en.etapas,
          avaliacoes: en.avaliacoes,
          lancamentos: l.lancamentos,
        },
        hoje,
      ),
    [
      c.fazendas,
      c.talhoes,
      c.plantios,
      c.safras,
      a.atividades,
      en.ensaios,
      en.produtos,
      en.etapas,
      en.avaliacoes,
      l.lancamentos,
      hoje,
    ],
  );

  // Clima da primeira fazenda com local (sede ou talhão desenhado).
  const fazendaDoClima =
    c.fazendas.find((f) => localDaFazenda(f, c.talhoes)) ?? null;
  const { clima } = useClima(
    fazendaDoClima ? localDaFazenda(fazendaDoClima, c.talhoes) : null,
  );

  return (
    <VistaDoDashboardDoCampo
      dados={dados}
      carregando={c.carregando || a.carregando || en.carregando}
      semFazenda={!c.carregando && c.fazendas.length === 0}
      semTalhao={!c.carregando && c.talhoes.length === 0}
      clima={clima}
      fazendaDoClima={fazendaDoClima}
      hoje={hoje}
    />
  );
}

// ------------------------------------------------------------------- vista

const hojeIso = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const diaMes = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const ha = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const brl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const emDias = (d: number) =>
  d === 0
    ? "hoje"
    : d === 1
      ? "amanhã"
      : d === -1
        ? "ontem"
        : d < 0
          ? `há ${-d} dias`
          : `em ${d} dias`;

export function VistaDoDashboardDoCampo({
  dados,
  carregando,
  semFazenda,
  semTalhao,
  clima,
  fazendaDoClima,
  hoje,
}: {
  dados: DashboardDoCampo;
  carregando: boolean;
  semFazenda: boolean;
  semTalhao: boolean;
  clima: Clima | null;
  fazendaDoClima: Fazenda | null;
  hoje: string;
}) {
  const n = dados.numeros;
  const v = (x: string) => (carregando ? "..." : x);

  return (
    <div className="space-y-6">
      {semFazenda && <PrimeirosPassos semTalhao={semTalhao} />}

      {/* Números: uma linha, o mesmo card do Dashboard do Finanças. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Numero
          rotulo="Talhões"
          valor={v(String(n.talhoes))}
          detalhe={`${ha(n.areaTotal)} ha`}
          link="/campo/talhoes"
        />
        <Numero
          rotulo="Plantios em andamento"
          valor={v(String(n.plantiosAtivos))}
          detalhe={`${ha(n.areaPlantada)} ha plantados`}
          link="/campo/plantios"
        />
        <Numero
          rotulo="Atividades planejadas"
          valor={v(String(n.atividadesProximas))}
          detalhe={
            n.atividadesAtrasadas
              ? `${n.atividadesAtrasadas} atrasada${n.atividadesAtrasadas > 1 ? "s" : ""}`
              : "próximos 14 dias"
          }
          alerta={n.atividadesAtrasadas > 0}
          link="/campo/atividades"
        />
        <Numero
          rotulo="Ensaios em andamento"
          valor={v(String(n.ensaiosAtivos))}
          detalhe={
            n.avaliacoesRecentes
              ? `${n.avaliacoesRecentes} avaliaç${n.avaliacoesRecentes > 1 ? "ões" : "ão"} em 30 dias`
              : "sem avaliação em 30 dias"
          }
          link="/campo/ensaios"
        />
        <Numero
          rotulo="Próxima colheita"
          valor={v(
            n.proximaColheita
              ? diaMes(n.proximaColheita.plantio.expected_harvest_date!)
              : "—",
          )}
          detalhe={
            n.proximaColheita
              ? `${emDias(n.proximaColheita.dias)} · ${n.proximaColheita.plantio.crop}`
              : "nenhuma prevista"
          }
          link={
            n.proximaColheita
              ? `/campo/plantios?abrir=${n.proximaColheita.plantio.id}`
              : "/campo/plantios"
          }
        />
        <Numero
          rotulo={n.custo ? `Custo · ${n.custo.safra.name}` : "Custo da safra"}
          valor={v(n.custo ? brl(n.custo.realizado) : "—")}
          detalhe={
            n.custo ? `${brl(n.custo.porHa)}/ha` : "cadastre a safra vigente"
          }
          link={n.custo ? "/campo/custos" : "/campo/safras"}
        />
      </div>

      {/* Clima da fazenda. */}
      <Cartao
        titulo={fazendaDoClima ? `Clima · ${fazendaDoClima.name}` : "Clima"}
        acao={{ rotulo: "Ver previsão", link: "/campo/clima" }}
      >
        {clima && fazendaDoClima ? (
          <ResumoDoClima clima={clima} compacto />
        ) : (
          <p className="text-sm text-slate-500">
            {fazendaDoClima
              ? "Buscando a previsão…"
              : "Marque a sede de uma fazenda ou desenhe um talhão para ver o clima e a janela de aplicação."}
          </p>
        )}
      </Cartao>

      {/* Três colunas, cada uma com lugares fixos: as três ficam com a mesma
          altura mesmo vazias, como no Flag Field. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Cartao
          titulo="Próximas colheitas"
          acao={{ rotulo: "Plantios", link: "/campo/plantios" }}
        >
          <Lista
            vazio="Nenhuma colheita prevista."
            itens={dados.colheitas.map((x) => ({
              id: x.plantio.id,
              link: `/campo/plantios?abrir=${x.plantio.id}`,
              data: diaMes(x.plantio.expected_harvest_date!),
              titulo: identidadeDoPlantio(x.plantio),
              sub: x.talhao ?? "",
              lado: emDias(x.dias),
            }))}
          />
        </Cartao>

        <Cartao
          titulo="Próximas atividades"
          acao={{ rotulo: "Calendário", link: "/calendario" }}
        >
          <Lista
            vazio="Nenhuma atividade planejada."
            itens={dados.atividades.map((x) => ({
              id: x.atividade.id,
              link: `/campo/atividades?abrir=${x.atividade.id}`,
              data: diaMes(x.atividade.date),
              dataAlerta: x.atrasada,
              cor: TIPOS[x.atividade.type].cor,
              titulo: TIPOS[x.atividade.type].rotulo,
              sub: x.talhao ?? "Fazenda",
              lado: x.atrasada ? "atrasada" : emDias(x.dias),
              ladoAlerta: x.atrasada,
            }))}
          />
        </Cartao>

        <Cartao
          titulo="Últimas avaliações"
          acao={{ rotulo: "Ensaios", link: "/campo/ensaios" }}
        >
          <Lista
            vazio="Nenhuma avaliação registrada."
            itens={dados.avaliacoes.map((x) => ({
              id: x.avaliacao.id,
              link: `/campo/ensaios?abrir=${x.ensaio.id}`,
              data: diaMes(x.avaliacao.date),
              cor: TIPOS_DE_ENSAIO[x.ensaio.trial_type].cor,
              titulo: x.ensaio.name,
              sub: [x.etapa, x.produto].filter(Boolean).join(" · "),
              lado:
                x.avaliacao.date === hoje
                  ? "hoje"
                  : emDias(-diasAte(x.avaliacao.date, hoje)),
            }))}
          />
        </Cartao>
      </div>
    </div>
  );
}

const diasAte = (de: string, ate: string) =>
  Math.round(
    (Date.parse(`${ate}T12:00:00`) - Date.parse(`${de}T12:00:00`)) / 86_400_000,
  );

// ---------------------------------------------------------------- blocos

function Cartao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: { rotulo: string; link: string };
  children: ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-500 truncate">
          {titulo}
        </h2>
        {acao && (
          <Link
            to={acao.link}
            className="shrink-0 text-xs text-slate-500 hover:text-slate-900"
          >
            {acao.rotulo} →
          </Link>
        )}
      </div>
      {children}
    </section>
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
      className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors min-w-0"
    >
      <p className="text-sm text-slate-500 truncate">{rotulo}</p>
      <p className="text-base font-medium mt-1 tabular-nums text-slate-900 truncate">
        {valor}
      </p>
      <p
        className={cn(
          "mt-1 text-sm truncate",
          alerta ? "text-red-700" : "text-slate-500",
        )}
      >
        {detalhe}
      </p>
    </Link>
  );
}

interface ItemDaLista {
  id: string;
  link: string;
  data: string;
  dataAlerta?: boolean;
  cor?: string;
  titulo: string;
  sub: string;
  lado: string;
  ladoAlerta?: boolean;
}

function Lista({ itens, vazio }: { itens: ItemDaLista[]; vazio: string }) {
  const sobra = Math.max(0, ITENS_POR_COLUNA - itens.length);
  return (
    <ul className="space-y-1">
      {itens.map((x) => (
        <li key={x.id}>
          <Link
            to={x.link}
            className="flex items-center gap-3 h-12 -mx-2 px-2 rounded-md hover:bg-slate-50"
          >
            <span
              className={cn(
                "w-11 shrink-0 text-sm tabular-nums",
                x.dataAlerta ? "text-red-700" : "text-slate-500",
              )}
            >
              {x.data}
            </span>
            {x.cor && (
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: x.cor }}
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-slate-800">
                {x.titulo}
              </span>
              {x.sub && (
                <span className="block truncate text-xs text-slate-500">
                  {x.sub}
                </span>
              )}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs",
                x.ladoAlerta ? "text-red-700" : "text-slate-500",
              )}
            >
              {x.lado}
            </span>
          </Link>
        </li>
      ))}
      {/* Lugares vazios: a coluna mantém a altura de 5 itens. No primeiro, o
          aviso; nos outros, só a faixa clara. */}
      {Array.from({ length: sobra }).map((_, i) => (
        <li
          key={`vazio-${i}`}
          aria-hidden={i > 0 || itens.length > 0}
          className="flex items-center h-12 -mx-2 px-2 rounded-md bg-slate-50/60"
        >
          {i === 0 && itens.length === 0 ? (
            <span className="text-sm text-slate-400">{vazio}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PrimeirosPassos({ semTalhao }: { semTalhao: boolean }) {
  const passos: { n: number; titulo: string; texto: string; link: string }[] = [
    {
      n: 1,
      titulo: "Cadastre uma fazenda",
      texto: "Nome, cidade e a sede no mapa (é dela que vem o clima).",
      link: "/campo/fazendas",
    },
    {
      n: 2,
      titulo: "Desenhe os talhões",
      texto: "Desenhe no mapa: a área sai do próprio desenho.",
      link: "/campo/talhoes",
    },
    {
      n: 3,
      titulo: "Lance o plantio",
      texto: "Cultura, data e previsão de colheita — e o resto se organiza.",
      link: "/campo/plantios",
    },
  ];
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
      <div>
        <h2 className="text-base font-medium text-slate-900">
          Comece pelo Field
        </h2>
        <p className="text-sm text-slate-500">
          {semTalhao
            ? "Três passos para o painel ganhar vida."
            : "Falta pouco."}
        </p>
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {passos.map((p) => (
          <li key={p.n}>
            <Link
              to={p.link}
              className="flex gap-3 h-full rounded-md border border-slate-200 p-3 hover:border-slate-300 transition-colors"
            >
              <span className="size-6 shrink-0 rounded-full bg-slate-800 text-white text-xs font-medium inline-flex items-center justify-center">
                {p.n}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  {p.titulo}
                </span>
                <span className="block text-sm text-slate-500">{p.texto}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

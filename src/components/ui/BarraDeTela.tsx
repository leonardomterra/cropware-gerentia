import { useState, type ReactNode } from "react";
// O funil saiu dos dois lugares. Ele desenha o ATO de filtrar, e os dois botões
// aqui não são isso: um abre um painel de campos (uma lista com busca), o outro
// abre o card com os controles da tela. Ícone que descreve a ação errada
// atrapalha mais do que ícone nenhum. Os dois são DIFERENTES de propósito —
// repetir o desenho faria o cabeçalho e o botão de dentro parecerem o mesmo
// controle, um dentro do outro.
import ListMagnifyingGlass from "~icons/ph/list-magnifying-glass";
import SlidersHorizontalDuotone from "~icons/ph/sliders-horizontal-duotone";
import ChevronDown from "~icons/ph/caret-down";
import { Button } from "./button";
import { FilterCountBadge } from "./FilterCountBadge";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useIsMobile } from "./use-mobile";
import { cn } from "./utils";
import {
  BOTAO_BARRA,
  ICONE_BOTAO_BARRA,
  PAINEL_ESCURO,
  ROTULO_PAINEL_ESCURO,
  SETA_BOTAO_BARRA,
} from "@/lib/ui-tokens";

/** Um campo à vista na barra. No CELULAR ele desce para o painel. */
export interface CampoDaBarra {
  /** Só aparece no painel — na barra o próprio valor do campo se explica. */
  rotulo: string;
  campo: ReactNode;
  /**
   * Se este campo está filtrando algo agora. No celular ele some da vista, e
   * sem isto o badge mentiria: o usuário veria a lista curta sem nada indicando
   * por quê. Quem sabe a resposta é a tela, não a barra.
   */
  ativo?: boolean;
}

export interface BarraDeTelaProps {
  /** Busca. Fica sempre à vista, inclusive no celular — é o filtro mais usado. */
  busca?: ReactNode;
  /** Campos à vista no desktop; no celular, dentro do painel. */
  campos?: CampoDaBarra[];
  /** O que já morava no painel escuro. */
  painel?: ReactNode;
  /** Filtros ativos que vivem no painel. Os `campos` ativos entram sozinhos. */
  filtrosAtivos?: number;
  /** Secundárias (Ordenar, Atualizar). */
  acoes?: ReactNode;
  /** A principal (Novo, Exportar). No celular ocupa a largura da linha. */
  acaoPrincipal?: ReactNode;
  /**
   * Se a BUSCA tem texto agora. Recolhida no celular, ela some da vista, e sem
   * isto o card fechado não teria como avisar que a lista está filtrada.
   */
  buscaAtiva?: boolean;
  /** Título do card recolhido, no celular. */
  tituloMobile?: string;
  className?: string;
}

/**
 * A barra de filtros e ações — UMA implementação para o app inteiro.
 *
 * POR QUE EXISTE. Treze telas montavam esta barra à mão, repetindo a mesma
 * string de classes. Ninguém errou de propósito: elas divergiram. Em 25/08/2026
 * a de Backups foi encontrada com a seta do "Filtros" sendo um `<span>` VAZIO —
 * o espaço reservado, a seta nunca desenhada — e com a contagem de filtros
 * escrita à mão em vez do `FilterCountBadge`. Enquanto o layout for copiado,
 * cada tela nova nasce com a chance de divergir de novo.
 *
 * O CELULAR é o motivo de ela ter nascido agora. Espalhados, os controles caíam
 * em três ou quatro linhas irregulares, com rótulo truncado, e empurravam a
 * lista para fora da tela — na maioria das visitas pelo celular a pessoa só quer
 * consultar, não filtrar. A regra mora aqui dentro:
 *
 *   celular:  [ busca .......... ] [ Filtros ² ]
 *             [ ação principal .................. ] [ ações ]
 *
 *   desktop:  [ busca ] [ campos ] [ Filtros ² ] [ ações ] [ ação principal ]
 *
 * Os campos à vista DESCEM PARA O PAINEL no celular, com seus rótulos. Não
 * somem: o badge conta os que estão filtrando, então recolher não esconde que a
 * lista está filtrada — que é o jeito de alguém olhar um total errado sem
 * entender por quê.
 *
 * O que NÃO entra aqui: seletor de período. Ele já tem o navegador
 * `‹ Agosto 2026 ›` logo abaixo em toda tela que o usa, e no celular repetir os
 * dois é gastar uma das duas linhas com informação que já está na tela. Quem
 * usa a barra decide não passá-lo quando `useIsMobile()`.
 */
export function BarraDeTela({
  busca,
  campos = [],
  painel,
  filtrosAtivos = 0,
  acoes,
  acaoPrincipal,
  buscaAtiva = false,
  tituloMobile = "Filtros e Ações",
  className,
}: BarraDeTelaProps) {
  const isMobile = useIsMobile();
  const [aberto, setAberto] = useState(false);
  // O card do celular nasce FECHADO: a maioria das visitas pelo telefone é
  // consulta rápida, e quem só quer olhar não deveria pagar meia tela de
  // controles por isso.
  const [expandido, setExpandido] = useState(false);

  const camposNaBarra = isMobile ? [] : campos;
  const camposNoPainel = isMobile ? campos : [];
  const temPainel = painel != null || camposNoPainel.length > 0;
  const contagem = filtrosAtivos + camposNoPainel.filter((c) => c.ativo).length;

  const botaoFiltros = temPainel ? (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(BOTAO_BARRA, "rounded-md", isMobile && "shrink-0")}
        >
          <ListMagnifyingGlass className={ICONE_BOTAO_BARRA} />
          Filtros
          <FilterCountBadge count={contagem} />
          <ChevronDown className={SETA_BOTAO_BARRA} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={PAINEL_ESCURO}
        // No celular o painel acompanha a largura da tela, e não a do botão:
        // um campo espremido em 120px não se preenche com o polegar.
        style={
          isMobile
            ? { width: "calc(100vw - 2rem)", maxWidth: "24rem" }
            : undefined
        }
      >
        {camposNoPainel.map((c) => (
          <div key={c.rotulo} className="space-y-1.5">
            <label className={ROTULO_PAINEL_ESCURO}>{c.rotulo}</label>
            {c.campo}
          </div>
        ))}
        {painel}
      </PopoverContent>
    </Popover>
  ) : null;

  if (isMobile) {
    const ativos = contagem + (buscaAtiva ? 1 : 0);
    return (
      <div
        className={cn(
          "rounded-xl border border-slate-200 overflow-hidden w-full",
          className,
        )}
      >
        {/* Mesma anatomia do CardSensivel: cabeçalho que é um botão inteiro,
            com a seta girando. Um alvo de toque da largura da tela erra menos
            que um ícone de 20px no canto. */}
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          aria-expanded={expandido}
          // Cinza da casa, o mesmo dos cabeçalhos de tabela. Fechado, o card é
          // a única coisa acima da lista e precisa se separar dela — mas com
          // TOM, não com cor: nesta tela cor tem significado (verde entra,
          // vermelho sai), e um cabeçalho colorido sugere um sentido que ele
          // não tem.
          className="w-full px-3 py-2.5 flex items-center gap-2 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <SlidersHorizontalDuotone className="size-[18px] shrink-0 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            {tituloMobile}
          </span>
          {/* FECHADO NÃO PODE SER CEGO. Sem esta contagem, alguém olha uma
              lista filtrada, estranha o total e não tem como descobrir por
              quê — que é o pior desfecho possível de recolher. */}
          <FilterCountBadge count={ativos} />
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-slate-500 ml-auto transition-transform",
              expandido && "rotate-180",
            )}
          />
        </button>

        {/* EM CASCATA, um por linha, e não dois a dois. Só faz sentido porque
            o card nasce fechado: a altura extra é paga por quem escolheu abrir.
            Lado a lado, "Buscar por origem ou descrição" cabia pela metade e o
            polegar dividia 180px com o vizinho. */}
        {expandido && (
          <div className="px-3 pb-3 pt-2 space-y-2 border-t border-slate-100 [&_button]:w-full [&_button]:justify-start">
            {/* A ação principal vem LOGO DEPOIS DA BUSCA, e não no fim: no
                celular ela é o que mais se toca, e o fim da pilha é o pior
                lugar de uma lista que se lê de cima para baixo. */}
            {busca}
            {acaoPrincipal}
            {botaoFiltros}
            {acoes}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2 w-full", className)}>
      {/* Grade e não flex: num flex a largura mínima do item é o `min-content`,
          e bastava um nome de centro maior para a busca encolher. */}
      <div
        className={cn(
          "grid flex-1 min-w-0 gap-2 grid-cols-1",
          camposNaBarra.length === 1 && "sm:grid-cols-2",
          camposNaBarra.length >= 2 && "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {busca}
        {camposNaBarra.map((c) => (
          <div key={c.rotulo}>{c.campo}</div>
        ))}
      </div>
      {botaoFiltros}
      {acoes}
      {acaoPrincipal}
    </div>
  );
}

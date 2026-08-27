/**
 * Tokens de superfície e de barra de ações — portados do Flag Field
 * (`cropware-flagfield/src/lib/ui-tokens.ts`), Etapa A de
 * `docs/ADOCAO-DESIGN-FLAGFIELD.md`.
 *
 * Vivem aqui, e não dentro da tela que os estreia, porque a partir da segunda
 * tela eles seriam copiados. Cópia de classe Tailwind não avisa quando diverge:
 * um `hover` ajustado num arquivo e esquecido no outro passa despercebido até
 * alguém pôr as duas telas lado a lado. Foi copiando que o menu de conta do
 * Flag Field ficou preso numa versão antiga do vidro enquanto os dropdowns já
 * tinham evoluído.
 *
 * NOTA SOBRE AS CLASSES `slate-*`: aqui elas são a família neutra DO APP, não o
 * slate do Tailwind — `app.css @theme` redefine `--color-slate-50..950`. Trocar
 * a paleta neutra inteira é editar aqueles 11 valores; estes tokens acompanham
 * sozinhos. Já `stone` é o stone de verdade, e é de propósito (ver o tooltip).
 */
import { cn } from "@/components/ui/utils";

/**
 * Vidro escuro dos menus e painéis.
 *
 * Escuro por contraste: a página é branca, e um menu branco sobre fundo branco
 * se separa do conteúdo só por um fio cinza.
 *
 * TRANSPARÊNCIA REAL — dá pra reconhecer o que está atrás, não um borrão. Duas
 * coisas fazem isso, e as duas foram ajustadas juntas no Flag Field:
 *
 *  - `backdrop-blur-sm`, nunca `-xl`. O blur forte transforma o fundo num borrão
 *    uniforme e o efeito lê como vidro fosco, não como transparência.
 *  - 65%, não 85%. Sobre um card branco, 85% compõem um cinza escuro que lê como
 *    sólido.
 *
 * **65% é o piso, não um número solto:** o composto sobre branco fica em
 * ~#686868, e texto BRANCO ali dá 4,5:1 — o mínimo legível. É por isso que os
 * itens são brancos e não cinza-claro; em `slate-300` cairiam para ~2,9:1.
 * Abrir mais tira o menu da faixa legível justamente sobre o conteúdo colorido
 * que faz a transparência aparecer.
 */
export const SUPERFICIE_ESCURA =
  "rounded-xl border border-white/10 bg-slate-900/65 backdrop-blur-sm text-white shadow-xl";

/**
 * Vidro do tooltip. Mesma família, com duas diferenças deliberadas:
 *
 *  - **Cinza QUENTE (stone)**, não o neutro dos menus. A diferença é de
 *    TEMPERATURA, não de cor declarada: distingue "dica passageira" de "menu com
 *    que dá pra interagir" sem inventar outra linguagem visual. Aparece quando os
 *    dois estão na tela e passa despercebida quando não estão. Por isso `stone`
 *    fica fora do remapeamento de paleta do `@theme` — se ele acompanhasse os
 *    menus, a distinção sumia.
 *  - **`backdrop-saturate-150`** puxa a cor de trás em vez de só clarear, o que
 *    ajuda justamente nos fundos de pouco contraste.
 *
 * A opacidade é a mesma 65% dos menus: em 75% o composto fica escuro demais e a
 * transparência não aparece. Aqui o branco dá ~5,0:1 sobre o composto — perto do
 * piso, porque o texto é de 13px.
 */
export const SUPERFICIE_TOOLTIP =
  "rounded-lg border border-white/10 bg-stone-800/65 backdrop-blur-sm backdrop-saturate-150 text-white shadow-lg";

/**
 * Conteúdo de DropdownMenu escuro — é o PADRÃO do componente, não anotação de
 * chamada. Duas coisas quebram ao pôr um menu no escuro, e as duas moram aqui:
 *
 *  - **Ícones apagados.** O item base pinta todo `svg` sem cor própria com um
 *    cinza de tema claro. Aqui eles voltam em `white/70`: visíveis, mas um passo
 *    atrás do rótulo, que é quem carrega o significado. O seletor exclui quem já
 *    tem cor (o vermelho do Excluir, por exemplo).
 *  - **Item "selecionado" com fundo claro** vira um bloco cinza sobre o menu
 *    escuro. Use `bg-white/15`, coerente com o `bg-white/10` do foco.
 */
export const MENU_ESCURO = cn(
  SUPERFICIE_ESCURA,
  "p-2",
  "[&_[role=menuitem]]:text-white",
  "[&_[role=menuitem]:focus]:bg-white/10 [&_[role=menuitem]:focus]:text-white",
  "[&_[role=separator]]:bg-white/10",
  "[&_[role=menuitem]_svg:not([class*='text-'])]:text-white/70",
);

/**
 * Painel de Popover escuro (o "Filtros").
 *
 * Os controles DENTRO dele continuam BRANCOS. Escurecê-los foi testado e
 * descartado no Flag Field: texto claro sobre painel escuro dentro de outro
 * painel escuro perdia contraste. Campo branco sobre fundo escuro é a separação
 * mais forte que existe.
 *
 * O `max-h` usa a variável do Radix pra o painel nunca passar da janela — sem
 * ela, um painel com muitos campos era cortado sem rolagem.
 */
export const PAINEL_ESCURO = cn(
  "p-4 space-y-3 z-[999] rounded-xl border border-white/10 text-white",
  "bg-slate-900/65 backdrop-blur-sm",
  "max-h-[min(70vh,var(--radix-popover-content-available-height))] overflow-y-auto",
);

/**
 * Rótulo de campo dentro do painel escuro. Branco, e não cinza: sobre o vidro a
 * 65% o `slate-400` cai para ~2,2:1.
 */
// 14px, o piso do app — estava em 13px, único texto do painel abaixo da régua.
export const ROTULO_PAINEL_ESCURO = "text-sm font-normal text-white";

/**
 * Botão da barra de filtros (Filtros, Ordenar, Exportar...).
 *
 * `shrink-0` é o que impede os botões de serem espremidos quando os campos ao
 * lado crescem; sem ele, nomes longos achatam os rótulos.
 */
export const BOTAO_BARRA =
  "h-9 px-4 shrink-0 font-normal shadow-none border-0 bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300";

/**
 * CAMPO da barra (o seletor de Centro de Custo, ao lado da busca).
 *
 * Mesmo fundo dos campos do app (branco), e não o `slate-100` dos botões da
 * barra. Na primeira linha convivem duas coisas diferentes: CAMPOS, que guardam
 * um valor escolhido, e BOTÕES, que abrem painel — dar o mesmo tom aos dois
 * fazia o centro de custo ler como ação, e não como filtro preenchido.
 *
 * A regra da linha: **campo é um degrau mais claro que botão.** (Nasceu como
 * "campo é branco" em 19/08; no mesmo dia os campos do app inteiro passaram a
 * ter um cinza leve, e a regra virou relativa em vez de absoluta.)
 */
export const CAMPO_BARRA =
  "h-9 w-full inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors " +
  "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 text-sm " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 [&>svg]:size-[18px]";

/** Ícone à esquerda do rótulo, dentro de BOTAO_BARRA. */
export const ICONE_BOTAO_BARRA = "size-3.5 mr-2 shrink-0";

/**
 * Seta ao final do botão. **Sem divisória antes dela** — foi testada e
 * descartada: como borda ela desenha a aresta de um bloco separado, e o botão
 * passa a ler como dois.
 */
// `ml-auto` e não `ml-1.5`: num botão do tamanho do conteúdo (o desktop) não
// muda nada, porque não sobra espaço para empurrar. Num botão de LARGURA CHEIA
// (o celular, dentro do card da BarraDeTela) ele joga a seta para a direita, e
// as setas de todos os botões passam a cair na mesma coluna. Sem isso cada uma
// parava logo depois do seu rótulo, e a coluna ficava serrilhada.
export const SETA_BOTAO_BARRA = "size-3.5 ml-auto opacity-50 shrink-0";

/**
 * Largura do menu suspenso que sai de um botão da barra.
 *
 * No celular ele acompanha a TELA, como o painel de Filtros: um menu de 256px
 * embaixo de um botão de largura cheia parece pertencer a outra coisa, e sobra
 * espaço morto ao lado. No desktop volta aos 256px de sempre.
 */
export const MENU_DA_BARRA = "w-[calc(100vw-2rem)] sm:w-64";

/** Contador de filtros ativos, dentro do botão Filtros. */
export const BADGE_BOTAO_BARRA =
  "ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-slate-800 text-white text-[11px]";

/**
 * Botão de ações ("⋯") de item de lista.
 *
 * Com contorno, nunca fantasma: solto sobre o card branco os três pontos leem
 * como decoração.
 *
 * NÃO inclui tamanho — cada lista casa a altura com o que estiver ao lado.
 * `data-[state=open]` importa: sem ele o gatilho perde o destaque justamente
 * enquanto o menu está aberto.
 */
export const BOTAO_ACOES =
  "p-0 shadow-none rounded-md border border-slate-200 bg-white text-slate-600 " +
  "hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 " +
  "data-[state=open]:bg-slate-100 data-[state=open]:border-slate-300 transition-colors";

/**
 * Ação PRIMÁRIA da barra ("Novo Lançamento"). A ÚNICA com fundo pintado — é o
 * que separa "criar" das demais ações, todas em BOTAO_BARRA cinza.
 *
 * O fundo é declarado aqui, e não herdado da variante `default` do Button, por
 * uma diferença de tema: o `default` daqui é `slate-900` com sombra (quase
 * preto), e o do Flag Field é o `primary` — o mesmo #525252 nos dois projetos,
 * chapado. Herdar traria o preto e a sombra junto.
 *
 * `w-full md:w-auto` no lugar de medir `window.innerWidth` em tempo de render —
 * a medida inline não acompanha o redimensionamento da janela.
 */
export const BOTAO_BARRA_PRIMARIO =
  "h-9 text-sm px-4 font-normal shadow-none border-0 w-full md:w-auto " +
  "bg-primary text-primary-foreground hover:bg-primary/90";

/**
 * Botão destrutivo dentro de barra flutuante de seleção.
 *
 * Preenchimento sólido não funciona sobre vidro: `red-500` cheio compete com a
 * lista atrás da barra, e escurecer só troca o tom do mesmo bloco de tinta. O
 * que resolve é inverter a proporção — o vermelho vira lavagem translúcida e
 * passa a viver no TEXTO e na borda.
 */
export const BOTAO_LOTE_DESTRUTIVO = cn(
  "h-8 px-4 font-normal text-sm shadow-none",
  "bg-red-500/15 text-red-200 border border-red-400/25",
  "hover:bg-red-500/25 hover:text-red-100 hover:border-red-400/40",
);

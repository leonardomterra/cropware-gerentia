# Adoção do design e da UX do Flag Field

> Estudo do `cropware-flagfield` e plano de incorporação no gerentia.
> Escrito em 19/08/2026, depois de ler o código, os tokens e o histórico de
> decisões dos dois lados.
>
> **Para MONTAR uma página nova, use `PADRAO-DE-PAGINA.md`** — é o resultado
> destilado deste plano, sem o histórico. Este documento aqui é o porquê e o
> que ainda falta (Etapa I).

---

## 1. A boa notícia: são irmãos, não estranhos

Os dois nasceram do mesmo tronco (Cropware Field/CDM) e **nunca trocaram de
stack**:

| | Flag Field | gerentia |
|---|---|---|
| React / Vite / TS | 18 / 6 / 5.9 | 18 / 6 / 5.9 |
| Tailwind | v4 + `@tailwindcss/vite` | **igual** |
| Base de componentes | shadcn sobre Radix | **igual** |
| Fonte de interface | Mozilla Text Variable | **igual** |
| Radius global | 4px | **igual** |
| Toast | sonner | **igual** |
| Ícones | Phosphor (via shim) | Material Symbols Light (unplugin-icons) |
| Paleta neutra | `neutral` (acromática) | `zinc` (hue 240) |

E vários componentes são literalmente parentes — `ItemsCount`, `EmptyStateCard`,
`KPICard`, `ConfirmActionDialog` e `tooltip` divergem entre **8 e 47 linhas**.
Isso muda a natureza do trabalho: não é reescrever a interface, é **reconciliar
duas cópias que evoluíram separadas**, e a de lá evoluiu mais.

O que o gerentia **não tem**: `ui-tokens.ts`, as superfícies de vidro,
`FilterCountBadge`, `BatchActionBar`, `PaginaDeFormulario` + modo leitura,
`ComboBox`.

---

## 2. O que o Flag Field descobriu (e vale trazer)

### 2.1 Os tokens moram em código, não no documento

`src/lib/ui-tokens.ts` guarda as classes com o **porquê junto**. O comentário do
arquivo diz o motivo de existir: *"Cópia de classe Tailwind não avisa quando
diverge: um hover ajustado num arquivo e esquecido no outro passa despercebido
até alguém colocar as duas telas lado a lado."*

E aconteceu: o menu de conta ficou preso numa versão antiga do vidro (85% com
blur forte) enquanto os dropdowns já tinham ido para 65%.

**É o primeiro item a trazer** — sem ele, tudo o que vier depois vira cópia.

### 2.2 As três superfícies de vidro

| Token | Onde | Composição |
|---|---|---|
| `SUPERFICIE_ESCURA` | dropdowns, flyout da lateral | `neutral-900/65` + `blur-sm` |
| `PAINEL_ESCURO` | popover de Filtros | idem, com `max-h` do Radix |
| `SUPERFICIE_TOOLTIP` | tooltips | `stone-800/65` + `blur-sm` + `saturate-150` |

Três decisões que só se descobre testando, e que já estão pagas:

- **65% é piso, não gosto.** `neutral-900` a 65% sobre branco compõe em ~#686868;
  texto branco ali dá 4,5:1 — o mínimo legível. Mais aberto que isso fica
  ilegível justamente sobre o conteúdo colorido que faz a transparência aparecer.
- **`blur-sm`, nunca `blur-xl`.** Blur forte vira vidro fosco, não transparência.
- **Tooltip é quente (stone), menu é neutro.** A diferença é de TEMPERATURA:
  distingue "dica passageira" de "menu clicável" quando os dois estão na tela, e
  passa despercebida quando não estão.

O gerentia hoje tem tooltip e dropdown **claros** — nenhum `backdrop-blur` no
código. É a mudança visual de maior impacto por linha alterada.

### 2.3 A escada de tons por POSIÇÃO da linha

| Linha do card | Tom | Contraste |
|---|---|---|
| 1ª | `neutral-900` | 17,4:1 |
| 2ª | `neutral-700` | 10,4:1 |
| 3ª | `neutral-500` | 4,8:1 |

**A regra é a posição, não o significado do campo.** Antes era caso a caso e o
olho lia como descuido, porque não havia regra a inferir.

E o corolário: **um tamanho só, 14px em todo o texto do card**. Três tamanhos
(15/14/13) eram diferença pequena demais para virar hierarquia e grande o
bastante para as listas parecerem levemente diferentes entre si — que é como o
usuário navega. A hierarquia foi para o **peso e a cor**.

`neutral-400` foi banido do texto: dá 2,5:1, reprova no AA.

### 2.4 Largura reservada, nunca reativa

Apareceu quatro vezes e virou regra: **todo controle cuja largura depende do
conteúdo anda quando o conteúdo muda, e leva os vizinhos junto.**

- `FilterCountBadge` reserva o espaço (`invisible`, não `hidden`);
- os campos de filtro ficam em **grade** (`minmax(0,1fr)`), não em flex;
- a `BatchActionBar` trava `md:min-w-[30rem]` e deixa o texto absorver a folga.

O agravante é quando o elemento é centralizado: crescer desloca as **duas**
bordas, e o alvo de clique muda de lugar entre um clique e o seguinte.

Junto disso, o achado que mais engana: *"selecionar um talhão mudava a largura do
campo de produtores"* — não era layout, era a **barra de rolagem** sumindo.
`scrollbar-gutter: stable` **no elemento que de fato rola** (o `<main>`, não o
`html`).

### 2.5 Ver é a tela de editar, travada

O padrão mais forte do Flag Field, e o mais aplicável aqui:

> Ver um registro abria um diálogo com um resumo desenhado à parte — outra ordem,
> outro formato, e um campo novo no formulário que ninguém lembrava de repetir lá.

A solução: a mesma página, dentro de um `<fieldset disabled>`, com a classe
`.modo-leitura` que devolve contraste cheio (o `disabled` do Tailwind é 50% de
opacidade — medida certa para UM campo travado, errada para uma tela inteira que
existe só para ser lida, no celular, sob sol).

O texto travado vem em `neutral-500` sobre fundo `#fafafa`: 4,55:1, com o mínimo
sendo 4,5:1. O comentário do CSS registra até o que fazer se um dia parecer forte
demais — clarear o FUNDO, nunca a letra.

**O gerentia tem exatamente o problema que isso resolve:** `ReceiptViewDialog`
(um resumo desenhado à parte) e `ReceiptFormDialog` (o formulário) são duas telas
para o mesmo registro.

### 2.6 Princípios de fluxo, colhidos do histórico

O histórico de commits de lá é um registro de decisões, e estes se repetem:

- **Responder perguntas, não oferecer um construtor.** O painel de Análises eram
  1.592 linhas de mini-BI (6 modelos, 2 métricas, 5 agrupamentos, 19 paletas...)
  que nascia travado numa combinação que deixava a tela vazia. Virou **duas
  perguntas respondidas ao abrir**, com dois filtros.
- **Um botão que muda de rótulo** no lugar de Editar/Cancelar/Salvar — *"Cancelar
  era salvar o que já estava lá"*.
- **Menu que tapa a tela inteira é uma tela se fingindo de menu.** A conta virou
  `/conta`, com voltar do sistema e endereço próprio.
- **Nada acima de 16px, e 16 só no título do painel.**
- **Ao remover um modo de visualização, liste o que só existia nele.** Trocar
  tabela por cards apagou a seleção em lote duas vezes.
- **Estado sem controle na interface aprisiona o usuário** — um filtro
  persistido sem botão deixa a lista recortada sem explicação.
- **Cor não pode ser o único código.** Verde e laranja ficam a ΔE 7 em
  deuteranopia; o papel virou selo escrito.

---

## 3. As três decisões (19/08/2026)

Levantei três ressalvas; duas foram revertidas pelo Leonardo e uma foi aceita.
Registro as três com o que eu havia argumentado, porque o argumento continua
valendo como *cuidado de execução* mesmo onde a decisão foi outra.

**A coluna de ícones de 64px — VAI ENTRAR.** Meu apontamento era que ela existe
no Flag Field por causa de ~37 itens em 9 grupos, e que o gerentia tem 12 itens
sem hierarquia. Decisão: adotar assim mesmo, por identidade entre os apps da
família. *Cuidado que fica de pé:* com 12 itens rasos, o trilho precisa de
agrupamento — 12 ícones soltos numa coluna sem rótulo é pior que a lateral
atual. A etapa vai propor os grupos antes de mexer no código.

**Material Symbols → Phosphor — VAI ENTRAR**, com as variantes coloridas e
duotone. Vira etapa própria, mecânica, com o gerador de shim que já existe lá
(`scripts/build-icon-shim.mjs`). *Cuidado:* o gerentia usa `unplugin-icons`
(`~icons/material-symbols-light/...`), que é import virtual — a migração troca o
modelo de import, não só o pacote.

**O card de lista em Lançamentos — FICA DE FORA**, como eu havia sugerido. O padrão de card do Flag Field foi validado
em sete listas de **entidades** (talhão, produtor, fazenda). A lista central do
gerentia é **financeira**: data, vencimento, origem, categoria, centro, status,
valor — sete colunas que se comparam entre linhas, que é exatamente o que tabela
faz melhor que card. Traria dali a **barra de filtros** (encaixa perfeito), a
escada de tons, o 14px único e o menu `⋯` — e manteria a tabela no desktop.

---

## 4. Plano por etapas

Ordenado por **impacto por linha alterada**, e cada etapa é independente: dá para
parar depois de qualquer uma sem deixar a interface pela metade.

### Etapa A — Fundação de tokens — ✅ FEITA em 19/08/2026
1. Criar `src/lib/ui-tokens.ts` com as três superfícies + os tokens de barra
   (`BOTAO_BARRA`, `BOTAO_ACOES`, `BADGE_BOTAO_BARRA`...), com os comentários.
2. Aplicar `SUPERFICIE_TOOLTIP` no `tooltip.tsx` e `MENU_ESCURO` no
   `dropdown-menu.tsx` — **os dois são padrão do componente**, não anotação de
   chamada.
3. `scrollbar-gutter: stable` no container que rola de verdade + a scrollbar
   discreta global.
4. Sumir com as setinhas do `input[type=number]`.

**Entregue.** Todo dropdown e tooltip do app mudaram de uma vez, sem tocar em
tela nenhuma. Verificado no app rodando: as cinco utilities novas foram geradas
pelo Tailwind (o risco real era o content scan não varrer `src/lib`, e não é o
caso), `scrollbar-width: thin` ativo, `input[type=number]` em `textfield`, zero
erro no console.

Dois achados durante a execução:

- **O `scrollbar-gutter: stable` do `<main>` não existia.** O comentário do
  `app.css` afirmava que existia — e o efeito colateral é exatamente o do Flag
  Field: filtrar até a lista caber faz a barra sumir e a barra de filtros inteira
  se reorganizar. Agora existe.
- **O dropdown do gerentia já era escuro, mas OPACO** (`bg-zinc-900` sólido). A
  mudança foi de sólido para vidro, não de claro para escuro — e o
  `collisionPadding` de 340px, que era fixo, virou 340 no toque e 12 no desktop
  (fixo, ele espremia menus de 6 itens no desktop).

### Etapa B — Paleta e tipografia — ✅ FEITA em 19/08/2026
1. **`zinc` → `neutral`**, nos 11 valores do `@theme`, nos tokens HSL de `:root`
   e nos 5 tokens `farm-primary-*`. As classes `slate-*` continuam as mesmas no
   app inteiro — mudou só o que elas significam.
2. **31 hex de zinc que estavam soltos** em 8 arquivos (breadcrumb, auth,
   3 diálogos, ItemsCount, Dashboard, CostCentersManager) foram trocados —
   senão eles ficariam sendo as únicas peças azuladas da tela.
3. **Badge tonal** `bg-{cor}-200 / text-{cor}-900` nos 17 esquemas de cor. Sobre
   card branco o 100 quase não se separava do fundo, e o selo existe pra ser
   lido de relance.
4. **Tipografia do badge** num lugar só: 12,5px, peso 500, `letter-spacing`
   0,02em.

**A paleta de Centro de Custo ficou de fora** — é escolha do usuário, palette à
parte (`docs/FARM-DESIGN-SYSTEM.md` §2). E os três textos acima de 16px que
existem são **códigos para transcrever** (convite de 6 dígitos, vínculo do
WhatsApp): a regra do teto é sobre texto de interface, não sobre um número que
existe pra ser lido em voz alta.

**Uma coisa NÃO foi portada, de propósito:** o badge do Flag Field é MAIÚSCULO, e
o gerentia tem a decisão explícita de não usar maiúsculas (`app.css`, "espelho
CDM"), com a utility `.uppercase` neutralizada globalmente. Reverter isso é uma
linha (`text-transform` no bloco `[data-slot="badge"]`), mas é reverter uma
decisão registrada — fica aguardando sua palavra.

### Etapa C — Barra de filtros e ações — ✅ PILOTO FEITO em 19/08/2026

Aplicada em **Lançamentos**. Como `ReceiptsListPage` é a casca compartilhada,
Notas e Recibos, Faturas e Anexos herdaram junto — o piloto já é a propagação.

A barra virou **duas linhas**:

```
[ busca ................ ][ Centro de Custo ▾ ]   [⚙ Filtros ⓿] [⇅ Ordenar ▾]
[+ Novo ] [Capturar ] [Toda a equipe | Só os meus] [ Mês ▾ ]
```

O que mudou de comportamento, e não só de aparência:

- **Centro de Custo saiu da linha de ações e virou campo à vista.** É filtro de
  uso constante; ele estava entre os botões, o que sugeria ação.
- **O botão de ordenar tem rótulo FIXO ("Ordenar").** Ele mostrava a opção ativa
  — "Recentes", "Maior valor" — e mudava de largura a cada escolha, empurrando os
  vizinhos. A opção ativa se lê abrindo o menu, onde já vem destacada.
- **O contador de filtros reserva o espaço** (`FilterCountBadge`): antes ele
  aparecia e sumia, e o botão inteiro crescia e encolhia a cada filtro.
- **Busca e Centro ficam numa GRADE**, não num flex. Em `minmax(0,1fr)` o
  conteúdo não alarga a coluna; num flex, um nome de centro grande encolhia a
  busca.
- **O painel virou `PAINEL_ESCURO`** com rótulos brancos (Tipo / Situação /
  Categoria) e campos brancos por dentro.
- O contador segue contando **só os filtros de dentro do painel** — contar o que
  está à vista faria o número anunciar o que já se vê.

**Resíduo da Etapa B corrigido junto:** 60 classes `zinc-*` em 11 arquivos. Só
`slate-*` tinha sido remapeado, então elas eram os únicos cinzas azulados que
restavam — e três delas estavam justamente nesta barra.

### Etapa D — Ver é editar travado — ✅ FEITA em 19/08/2026

`ReceiptViewDialog` **deixou de existir** (209 linhas). Ver um lançamento abre o
próprio `ReceiptFormDialog` dentro de um `<fieldset disabled>`, com a classe
`.modo-leitura`, e o rodapé troca Cancelar/Salvar por **Fechar/Editar** — o mesmo
botão que depois vira Salvar, na mesma posição.

**Por que isso importa mais do que parece:** o diálogo antigo era um resumo
desenhado à parte, com outra ordem e outro formato — e o que o formulário ganhava
não chegava lá. Duas divergências reais, conferidas no código antes de apagá-lo:

- **Centro de Custo não existia na tela de ver.** Está no formulário, está na
  tabela, e no detalhe do lançamento simplesmente não aparecia.
- **Lançamento PREVISTO aparecia como "A Pagar".** A tela de ver imprimia
  `STATUS_LABEL[status]` direto, sem olhar `is_estimated` — enquanto a lista e o
  formulário mostravam "Previsto". O mesmo lançamento tinha dois nomes conforme
  onde se olhava.

**O `.modo-leitura` não é cosmético.** O `disabled` dos componentes-base vale 50%
de opacidade — medida certa para UM campo travado no meio de um formulário
ativo, e errada para uma tela que existe só para ser lida, no celular, sob sol.
Medido no app rodando:

| | opacidade | texto | fundo |
|---|---|---|---|
| `:disabled` fora | **0,5** | `#171717` | transparente |
| dentro de `.modo-leitura` | **1** | `#737373` | `#fafafa` |

E o tom do texto é o **chão, não uma preferência**: `#737373` sobre `#fafafa` dá
**4,54:1**, com o mínimo AA sendo 4,5:1. Clarear para `#8a8a8a` cairia para
3,31:1 — reprova. Se um dia parecer forte demais, o caminho é clarear o FUNDO do
campo, nunca a letra.

**Duas coisas que a leitura precisava e o formulário não tinha:**

1. Um bloco final com **Fonte**, **CNPJ**, **Lançado por** e o botão *Ver
   arquivo* — dados que o formulário não edita, e que só existiam na tela
   paralela. Ficam aqui justamente para não voltar a ter dois lugares mostrando
   o mesmo lançamento.
2. **Os itens.** Lançamentos usa `allowItems=false`, então um lançamento
   itemizado (criado em Notas ou Faturas) perderia os itens na leitura — que era
   exatamente o que o diálogo antigo mostrava. Na leitura eles voltam em modo
   tabela.

**O botão Editar só aparece para quem pode editar** (`canEdit` por linha, da
Etapa de organizações). O gestor que abre o lançamento do colega agora tem uma
tela de leitura de verdade — antes ele via o detalhe e o botão simplesmente
sumia, o que era metade da solução.

> **Fora do escopo, por ora:** o `PaginaDeFormulario` do Flag Field (formulário
> de cadastro como PÁGINA, não diálogo). O argumento de lá vale aqui — no
> celular o teclado do iOS espreme o modal e a rolagem briga com a da tela atrás
> —, mas isso é rota nova e navegação, não a fusão de telas. Fica como etapa
> própria.

### Etapa E — Ícones Phosphor — ✅ FEITA em 19/08/2026 *(antecipada)*

**Antecipada de propósito:** a Etapa C cria interface nova COM ícones, e
construir a barra de filtros duas vezes — uma em cada família — é o retrabalho
que o plano existe pra evitar.

**Não foi portado o shim do Flag Field.** Lá o `@phosphor-icons/react` entra como
biblioteca de runtime, com um shim de 448 linhas gerado por script pra absorver
as props do Lucide. Aqui o app já usa `unplugin-icons`, que compila cada ícone
como componente no build (zero runtime, tree-shaking perfeito) — e o Iconify
publica o Phosphor inteiro em `@iconify-json/ph`, **com todos os pesos como
nomes próprios**: `~icons/ph/trash`, `-bold`, `-duotone`, `-fill`, `-light`,
`-thin`. Mesma família de desenho, mesmas variantes, e a migração vira troca do
CAMINHO do import — o alias local e o JSX não mudam.

Como foi feito:
1. Os 99 ícones distintos foram listados **com o alias local de cada um** — é o
   alias que diz a intenção (`Trash2`, `UserPlus`, `ArrowDownLeft`), não o nome
   do glifo do Material.
2. O mapa de 97 destinos foi **validado contra o `icons.json` do set** antes de
   tocar em arquivo nenhum. Nome errado aqui é ícone errado em produção.
3. 31 arquivos reescritos, 157 imports.

**Verificação:** o build compilou — nome inexistente quebraria — e a saída tem
**96 componentes com `viewBox 0 0 256 256`**, que é a assinatura do Phosphor,
contra 5 de 24×24 (os spinners `svg-spinners`/`line-md`, mantidos de propósito:
são animados e não têm equivalente no Phosphor).

**Um ajuste que teria estragado o resultado.** O `vite.config` usava `scale: 1.2`
e o `app.css` somava `transform: scale(1.1)` — 32% de aumento, criado porque o
`material-symbols-light` tem padding interno grande e o glifo parecia menor no
mesmo box. O Phosphor preenche o viewBox como o Lucide preenchia; o aumento saiu.
Se algum dia parecer pequeno, o botão de ajuste é aquele bloco do `app.css`, e
não o `scale` do vite (que define só o tamanho intrínseco — qualquer `size-*` na
className ganha dele).

**Centros de custo:** foram para o peso `-fill`, equivalente ao
`material-symbols` cheio que usavam ("encorpado, bom com fundo pintado"). O DB
guarda um `slug` estável, desacoplado do nome do glifo, então não houve migração.
Trocar pra `-duotone` é acrescentar um sufixo em `ccIcons.tsx`.

### Etapa F — Trilho de ícones de 64px — ✅ FEITA em 19/08/2026

Como combinado, começou pelo **agrupamento** — sem ele, onze ícones sem rótulo
numa coluna seriam piores que a lateral com nomes: sem rótulo, o ícone só
funciona quando o conjunto é pequeno o bastante pra virar memória de posição.

| Trilho | Abre |
|---|---|
| **Movimento** | Lançamentos · Notas e Recibos · Faturas · Anexos · Recorrências |
| **Acompanhar** | Dashboard · Relatórios |
| **A fazer** | Pendências · Notificações |
| **Organização** *(gestor)* | Configurações · Equipe |
| **Plataforma** *(master)* | Usuários · Organizações |

`RAIL_GROUPS`, no `AppShell`, **é o botão de ajuste** — rearranjar grupos não
mexe em componente nenhum. Os grupos são montados a partir dos itens **já
filtrados por papel**, então grupo sem item visível não aparece: "Plataforma"
some pra quem não é master, "Organização" some pro usuário comum.

**Sobre o clique a mais que eu tinha levantado:** no desktop o painel abre no
*hover*, então chegar em qualquer tela continua sendo **um clique**. O custo real
seria no toque — e o trilho é `hidden md:flex`; o celular segue com a gaveta de
lista plana, onde espaço não é o problema e agrupar cobraria um toque a mais.

**O que saiu junto:** a lateral com rótulos, o botão de recolher, o estado
`collapsed` e o `NavRow`. É a regra do Flag Field — *estado sem controle na
interface aprisiona o usuário*: deixar o `collapsed` vivo sem botão congelaria
quem estivesse recolhido. (A chave `farm:sidebar:collapsed` que ficou no
localStorage de quem já usou é inerte — ninguém mais lê.)

O rodapé do trilho é o **menu de conta**, agora só ícone: a coluna tem 64px, e o
nome do usuário mora dentro do próprio menu, junto da organização e do perfil —
que é o que explica ver ou não ver o dado dos colegas.

**Ajuste de 19/08 (uso real):** o painel não mostra mais o **nome do grupo**. Ele
abre a partir do ícone que a pessoa acabou de apontar, então o título repetia o
que ela já sabia e comia uma linha. O grupo continua nomeado no `aria-label` do
gatilho, que é o que o leitor de tela anuncia — a informação saiu da tela, não da
árvore de acessibilidade.

### Etapa G — Listas — ✅ FEITA em 19/08/2026

**A escada de tons, e o motivo de ela não ser gosto.** Medido no app:

| tom | contraste no branco | |
|---|---|---|
| `slate-400` | **2,52:1** | reprova no AA (mínimo 4,5) |
| `slate-500` | 4,74:1 | o piso |
| `slate-700` | 10,37:1 | |
| `slate-900` | 17,93:1 | |

A **terceira linha** do card ("Lançado por") estava em `slate-400` a 12px — ou
seja, reprovando por 2 pontos de contraste, no dado que a frente de organizações
acabou de introduzir. A segunda linha estava em `500`, um degrau abaixo do que
deveria.

Ficou **900 / 700 / 500 por POSIÇÃO da linha**, com **um tamanho só (14px)**:

- 1ª — origem (`font-medium`)
- 2ª — data · categoria
- 3ª — "Lançado por"

Não sobrou nenhum `text-xs` nos dois componentes de lista.

**Na tabela, a régra foi ADAPTADA, não transplantada.** A escada do Flag Field
vale para linhas empilhadas dentro de uma coluna de card. Numa tabela, subir
todas as colunas ao `900` deixaria a página inteira no tom mais forte ao mesmo
tempo — que é exatamente o que o próprio documento alerta no modo leitura. Então:
a coluna que IDENTIFICA a linha (origem) foi ao `900`, a segunda linha dela ao
`500`, e as demais colunas seguem no tom da tabela, que já tem cabeçalho pra
dizer o que é cada uma.

**O menu `⋯` ganhou contorno** (`BOTAO_ACOES`) nos dois — no card ele era
`ghost`, e solto sobre o branco os três pontos leem como decoração. O token traz
o `data-[state=open]`, sem o qual o gatilho apaga justamente enquanto o menu
está aberto.

**Fora do escopo, como combinado:** o card de lista do Flag Field na tela de
Lançamentos. A lista central daqui é financeira — sete colunas que se comparam
entre linhas — e isso é o que tabela faz melhor que card (ver §3).

### Etapa H — Ações em lote — ✅ FEITA em 19/08/2026

A seleção era uma fileira de botões espremida no cabeçalho, acima da lista.
Virou **barra flutuante de vidro**, que é o padrão do Flag Field: ela pousa sobre
a lista justamente onde o usuário acabou de marcar itens — por isso o vidro, e
não um fundo opaco que esconderia o que ele está selecionando.

- **Largura travada** (`md:min-w-[30rem]` + `flex-1` no texto): a barra é
  centralizada por `-translate-x-1/2`, então crescer desloca as DUAS bordas ao
  mesmo tempo e o botão Excluir muda de lugar entre um clique e o seguinte. O
  contador vai de 1 a 100 dígitos adentro; o texto absorve a folga.
- **O destrutivo é lavagem, não bloco.** Preenchimento sólido compete com a
  lista atrás do vidro; a cor vive no texto e na borda (`bg-red-500/15`,
  `text-red-200`, `border-red-400/25`).
- **Adaptação para o celular:** no Flag Field a barra fica a 12px do rodapé.
  Aqui o rodapé é a barra "Menu", que continua sendo o caminho de navegação
  enquanto a seleção existe — então a barra pousa **acima** dela
  (`bottom-[calc(3rem+12px+safe-area)]`).

**Um defeito que a mudança quase criou:** o rótulo passou a ser uma frase
("3 lançamentos selecionados"), e a aba **Faturas** usa substantivo feminino —
sairia *"1 fatura selecionado"*. `countNoun` ganhou `genero`, usado só por
Faturas. O rótulo é montado num **nó de texto só**: num `flex-wrap`, partido em
pedaços, a última palavra cai sozinha na linha de baixo.

### Etapa I — Fluxos *(PENDENTE — retomar aqui)*

Única etapa aberta. Não tem conteúdo fechado: depende de quais telas repensar.
Os princípios estão no §2.6; os candidatos levantados no estudo:

1. **A conta vira tela no celular.** Hoje é dropdown, e no celular aquele painel
   tapa a viewport inteira pra oferecer alvos de 36px — é "uma tela se fingindo
   de menu". Ganharia linha inteira, voltar do sistema e endereço próprio.
2. **O Dashboard com "perguntas respondidas"** em vez de mais controles. É o
   princípio mais forte do Flag Field: lá um painel de 1.592 linhas de mini-BI
   (6 modelos, 2 métricas, 5 agrupamentos, 19 paletas) virou duas perguntas que
   aparecem sozinhas ao abrir.
3. **Configurações revisada com a régua de "estado sem controle na interface"** —
   filtro que existe, filtra e é persistido mas não tem controle na tela deixa a
   lista recortada sem explicação.

Além disso, dois princípios que valem para qualquer tela quando ela for mexida:
**um botão que troca de rótulo** no lugar de Editar/Cancelar/Salvar (Cancelar era
salvar o que já estava lá), e **cor nunca como único código** — verde e laranja
ficam a ΔE 7 em deuteranopia.

> **Contexto da retomada (19/08):** as etapas A–H estão prontas e **não
> commitadas**. O Leonardo ia fazer polimentos manuais antes de seguir para esta
> etapa.

---

## 5. Como não gerar retrabalho

Três regras que valem para todas as etapas, tiradas dos erros já cometidos lá:

1. **Importe o token, nunca copie a classe.** Foi copiando que o menu de conta
   ficou preso numa versão antiga do tema.
2. **Piloto numa tela, revisão, depois propague.** A barra de filtros, o card de
   lista e a `BatchActionBar` seguiram esse caminho — e a `BatchActionBar` prova
   o contrário: virou cópia em oito telas, e uma delas tinha ganhado um ajuste
   que as outras não.
3. **Quando um elemento ganha fundo próprio, recalcule as bordas contra ESSE
   fundo.** A mesma armadilha apareceu três vezes lá.

---

## 6. Fontes deste estudo

Em `cropware-flagfield`:
- `docs/ui-polish-patterns.md` — 1.431 linhas, o documento vivo (seções 26–29 são
  o padrão atual; 24 está superada)
- `docs/cropware-design-system.md` — o guia Field→Farm de maio, **desatualizado**
  (fala em Geist e JetBrains Mono; o app já usa Mozilla Text)
- `src/lib/ui-tokens.ts` — a fonte de verdade dos tokens
- `src/app.css` — tokens, modo leitura, scrollbar, badge
- `src/components/ui/` — button, badge, tooltip, dialog, ItemsCount,
  FilterCountBadge, BatchActionBar, EmptyStateCard, KPICard, PaginaDeFormulario
- `src/components/AppSidebar.tsx` — navegação e flyout
- `git log` — o histórico de decisões de UX, que é onde os fluxos estão contados

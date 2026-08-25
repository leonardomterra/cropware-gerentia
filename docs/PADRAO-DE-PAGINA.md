# Padrão de página — anatomia, ordem e regras

> Referência viva: **`src/modules/receipts/components/ReceiptsListPage.tsx`**.
> Escrito em 19/08/2026, extraído da tela de Lançamentos depois da adoção do
> design do Flag Field (ver `ADOCAO-DESIGN-FLAGFIELD.md`).
>
> **Este documento substitui as seções 10 e 14 do `FARM-DESIGN-SYSTEM.md`**,
> que descrevem o layout anterior (botão "Filtrar" com "Limpar filtros" dentro
> do popover, fileira de ações em `flex-1`, badge `bg-zinc-800`). Aquilo não
> existe mais.

Para que serve: montar uma página nova — ou consertar uma antiga — sem ter que
reconstituir o padrão lendo Lançamentos linha a linha. Cada regra vem com o
**porquê**, porque regra sem motivo é a primeira a ser desfeita por engano.

---

## 1. Ordem vertical (é fixa)

```
1. (breadcrumb global — vem do AppShell, a página não desenha título)
2. Barra de busca e filtros          ← linha 1
3. Linha de ações                    ← linha 2
4. Contador + "Limpar Filtros"       ← alinhados à DIREITA
5. Régua de meses (quando a página tem escopo mensal)
6. Conteúdo (tabela, cards, gráficos)
7. Barra flutuante de seleção (só quando há itens marcados)
```

Sem `<h1>`: o breadcrumb já diz onde a pessoa está, e um título repetido come
uma linha em todas as telas.

A ordem importa. A pessoa **restringe** (2), depois **age** (3), depois
**confere quanto sobrou** (4). Inverter 3 e 4 já foi testado e a linha ficou
apertada: ela carrega o botão de criar e o alternador de equipe.

---

## 2. Linha 1 — busca e filtros

Referência: `ReceiptFiltersBar.tsx`, usada por Lançamentos e replicada em
Recorrências.

```
┌─────────────────────────────────────┬──────────────┬──────────┬───────────┐
│ 🔍 busca (estica)                   │ campo à vista│ Filtros ▾│ Ordenar ▾ │
└─────────────────────────────────────┴──────────────┴──────────┴───────────┘
```

**O que fica à vista x o que mora no painel.** À vista: o que se consulta toda
hora (a busca, e o Centro de Custo quando há mais de um). No painel: o resto,
que assim ocupa zero espaço enquanto não está em uso.

**A busca e os campos à vista vivem num `grid`, não num `flex`.** Num flex a
largura mínima do item é o `min-content`, e bastava um nome de centro maior para
a busca encolher. Em `grid` com `minmax(0,1fr)` as duas colunas são estáveis.

```jsx
<div className={cn("grid flex-1 min-w-0 gap-2 grid-cols-1", temCampo && "sm:grid-cols-2")}>
```

**Ordenar fica encostado em Filtros**, não na linha das ações — os dois
restringem/organizam a mesma lista.

**Rótulo de botão é FIXO.** "Ordenar", nunca "Maior valor". Mostrar a opção
ativa fazia o botão mudar de largura a cada escolha, e ele é vizinho da barra
inteira. A opção ativa se lê abrindo o menu, onde aparece com
`bg-white/10 font-medium`.

**Badge de contagem conta só os campos do painel.** Busca e centro estão à
vista; apontar um badge para algo que já se vê é ruído.

### Tokens (importe, não copie)

De `src/lib/ui-tokens.ts`:

| Token                                    | Onde                                                             |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `BOTAO_BARRA`                            | Filtros, Ordenar, Mês — `bg-slate-100`, sem borda                |
| `BOTAO_BARRA_PRIMARIO`                   | **só** o botão de criar — ver §3                                 |
| `CAMPO_BARRA`                            | seletor de Centro — `bg-slate-50` + borda, como os campos do app |
| `ICONE_BOTAO_BARRA` / `SETA_BOTAO_BARRA` | ícone à esquerda / chevron à direita                             |
| `PAINEL_ESCURO` / `ROTULO_PAINEL_ESCURO` | o popover de Filtros e seus rótulos                              |
| `FilterCountBadge`                       | contagem sobre o botão de Filtros                                |

**Dentro do painel escuro, os campos continuam BRANCOS** (`h-9 bg-white
text-slate-500`). Escurecê-los foi testado e descartado: texto claro sobre
painel escuro dentro de outro painel escuro perde contraste.

No mobile o popover recebe a largura do gatilho:

```jsx
style={isMobile ? { width: "var(--radix-popover-trigger-width)" } : undefined}
```

---

### No celular a barra é outra (e mora num componente só)

Use **`<BarraDeTela>`** (`components/ui/BarraDeTela.tsx`). Não monte a barra à
mão: em 25/08/2026 havia TREZE telas repetindo a mesma string de classes, e elas
divergiram sozinhas — a de Backups estava com a seta do "Filtros" sendo um
`<span>` vazio (o espaço reservado, a seta nunca desenhada) e com a contagem de
filtros escrita à mão em vez do `FilterCountBadge`.

```
celular:  [ busca .......... ] [ Filtros ² ]
          [ ação principal ................. ] [ ações ]

desktop:  [ busca ] [ campos ] [ Filtros ² ] [ ações ] [ ação principal ]
```

**Os campos à vista DESCEM PARA O PAINEL no celular**, com seus rótulos.
Espalhados, eles caíam em três ou quatro linhas irregulares, com rótulo
truncado, e empurravam a lista para fora da tela — e na maioria das visitas pelo
celular a pessoa só quer consultar, não filtrar.

**Eles não somem: o badge conta os que estão filtrando.** Cada campo declara
`ativo`, e recolher deixa de esconder que a lista está filtrada — que é o jeito
de alguém olhar um total errado sem entender por quê.

**O seletor de período não entra na barra no celular.** Toda tela que o usa já
tem o navegador `‹ Agosto 2026 ›` logo abaixo; repetir os dois gasta uma das
duas linhas com informação que já está na tela. Quem usa a barra não o passa
quando `useIsMobile()`.

---

## 3. Linha 2 — ações

**Exatamente um botão escuro por página: o de criar.** É o que separa "criar"
das demais ações, todas em cinza. Sem isso tudo tem o mesmo peso e nada é a ação
principal.

```jsx
<Button variant="default" className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5")}>
  <Plus className="size-[18px] shrink-0" />
  Nova Coisa
</Button>
```

O `variant="default"` explícito **e** o token juntos, porque o token declara
`bg-primary` por conta própria: a variante `default` do app aplica `bg-slate-900`
mais sombra, que não é essa cor. Um `variant="outline"` aqui é o erro mais comum
— aconteceu em Recorrências e em Pendências, as duas conversões de 19/08/2026.

**Criar é UMA porta, não duas.** Quando há mais de um caminho para o mesmo
resultado (preencher na mão x capturar foto), vira **um** botão com menu. Dois
botões de mesmo peso lado a lado faziam a escolha parecer maior do que é e
comiam a linha no celular. Com um caminho só, botão simples.

**Rótulos em Title Case:** "Novo Lançamento", "Capturar Recibo", "Limpar
Filtros", "Nova Recorrência".

Layout: `grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center` — dois por
linha no celular, fileira no desktop.

---

## 4. Contador e "Limpar Filtros"

Própria linha, encostados à direita, **com altura reservada**:

```jsx
<div className="flex items-center justify-end gap-1 mb-2 px-1 min-h-[28px]">
```

O `min-h` existe porque "Limpar Filtros" aparece e some. Sem ele a página inteira
pula quando alguém digita na busca.

Texto: `Mostrando 12 Lançamentos` — número, e o substantivo em Title Case, com
concordância de singular/plural.

**"Limpar Filtros" fica FORA do painel** (era dentro, no padrão antigo) e é
vermelho fantasma: `text-red-600 hover:bg-red-50`. Ele limpa busca + painel +
centro + escopo — **não** o mês. Mês é escopo da página, não filtro.

---

## 5. Estados: nunca desmontar o conteúdo

Esta é a regra que mais dá pulo de layout quando esquecida.

- **Carregando** = o mesmo conteúdo em `opacity-50 pointer-events-none` +
  spinner pequeno na linha de contagem. Nunca troque a tabela por um card de
  loading.
- **Vazio por filtro** = a mesma tabela com um `emptyLabel`, não um empty-state
  grande. O empty-state grande (`EmptyStateCard`) é só para "nunca houve nada".
- **Bloco que aparece e some** = reserve a altura. Ex.: o comparativo dos KPIs
  do Dashboard some durante o carregamento; como o grid iguala a altura da
  linha, a fileira inteira encolhia e crescia a cada troca de mês. Hoje o slot
  de 40px existe ocupado ou não.

---

## 6. Criar / editar / ver é PÁGINA INLINE, não dialog

Referência: `RecurringPage.tsx` (a conversão mais recente e mais simples de ler)
e `ReceiptFormDialog.tsx` com `modo="pagina"`.

**Por que página.** Num diálogo o teclado virtual do iOS espreme o conteúdo, a
rolagem do modal briga com a da página atrás (`max-h` + `overflow-y-auto` dentro
de algo que já rola) e sobra menos largura no celular. Formulário de cadastro é
longo e se preenche devagar — isso pesa. Para **confirmar** algo, o diálogo
continua sendo o certo.

**Uma tela, três estados.** Criar, editar e ver são o MESMO corpo de formulário.
Ver não é uma segunda tela: é esta, travada. Uma tela de leitura separada diverge
da de edição no primeiro campo novo que alguém adiciona — foi exatamente o que
aconteceu com o antigo `ReceiptViewDialog` (faltava Centro de Custo, e "Previsto"
aparecia como "A Pagar").

### Como montar

```jsx
const [formAberto, setFormAberto] = useState(false);
const [editando, setEditando] = useState<Coisa | null>(null);
const [somenteLeitura, setSomenteLeitura] = useState(false);

function abrirNovo()                       { setEditando(null); setSomenteLeitura(false); setFormAberto(true); }
function abrir(r: Coisa, leitura = false)  { setEditando(r); setSomenteLeitura(leitura); setFormAberto(true); }

// O formulário SUBSTITUI a lista — return antecipado, antes do JSX da página.
if (formAberto) {
  return (
    <PaginaDeFormulario
      formId="form-coisa"
      rotuloSalvar={editando ? "Salvar" : "Criar Coisa"}
      descricao={somenteLeitura ? editando?.nome ?? "" : editando ? `Editando ${editando.nome}` : "Nova coisa"}
      somenteLeitura={somenteLeitura}
      aoEditar={somenteLeitura ? () => setSomenteLeitura(false) : undefined}
      aoVoltar={() => { setFormAberto(false); setSomenteLeitura(false); }}
      salvando={salvando}
    >
      <form id="form-coisa" onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="space-y-3">
        {/* os campos, exatamente os mesmos nos três estados */}
      </form>
    </PaginaDeFormulario>
  );
}
```

Detalhes que a casca já resolve, e que não devem ser refeitos na página:

- **`formId` + `<form id>`**: o botão Salvar mora no cabeçalho, fora do
  `<form>` — o atributo `form` é o que liga os dois.
- **`fieldset disabled` único** envolve tudo: nenhum campo precisa saber que
  existe modo leitura. Mais a classe `.modo-leitura` no card, que dá os tons do
  Flag Field: fundo `#fafafa`, letra `#737373` (4,54:1 — margem fina, recalcule
  se mexer no fundo).
- **O fieldset sozinho NÃO basta.** Ele usa `display: contents`, e nesse caso o
  Chrome marca os controles como `:disabled` (por isso o visual funciona) mas
  **não bloqueia o clique**. Campo nativo fica inerte de qualquer jeito; widget
  movido a JS — os `Select` do Radix — continua abrindo o menu. Quem fecha o
  buraco é `.modo-leitura :disabled { pointer-events: none }`, no `app.css`.
  Não invente `disabled={somenteLeitura}` campo a campo: é fácil esquecer um.
- **Um botão só, que troca de rótulo**: "Editar" vira "Salvar" na MESMA posição.
  Sem Cancelar — cancelar ali era salvar o que já estava lá.
- **Sem permissão de editar**, basta omitir `aoEditar`: aparece "Somente
  leitura" com cadeado.

### Como se chega lá pela lista

- **Clique na linha/card abre em LEITURA** (`abrir(r, true)`), não em edição.
  Abrir direto em edição convida a alterar o que a pessoa só queria conferir.
- **Menu de ações**: `Ver` → `Editar` → (ações de estado) → `Excluir`
  destrutivo.
- **`stopPropagation` no contêiner do menu de ações**: sem isso, clicar no `⋮`
  dispara também o clique do card e abre a tela por baixo do menu.
- A linha/card precisa de `role="button"`, `tabIndex={0}` e `onKeyDown` para
  Enter/Espaço — clique sozinho não é acessível por teclado.

### Ver anexo: página a partir da lista, diálogo a partir do formulário

`PaginaDeAnexo` quando se chega de uma **lista** (há para onde voltar);
`AttachmentViewerDialog` quando se chega de **dentro do formulário** — lá é uma
espiada, e a tela de trás precisa continuar de pé com o que já foi digitado.
Os dois desenham o mesmo `AttachmentViewer`, então o conteúdo não diverge.

**PDF é rasterizado, nunca embutido em `<iframe>`.** O WKWebView do iOS não
renderiza PDF em iframe — fica em branco, e era daí que vinha o "Pré-visualização
indisponível no celular". `utils/pdfRaster.ts` transforma cada página em imagem
com pdf.js (carregado sob demanda), a primeira primeiro. Vale para qualquer
lugar do app que precise MOSTRAR um PDF.

A única exceção é `pdfViewerHtml`, em `mergeAttachmentsPdf.ts` — a aba que o
"Imprimir" dos anexos abre. Ela roda FORA da WebView: no app, o
`handlePrintSelected` desvia pro compartilhamento nativo antes de abrir aba
nenhuma. Está investigado e anotado lá, junto das condições que derrubariam a
exceção; não precisa reabrir.

### Limite conhecido

É **troca de conteúdo, não rota nova**. Não há URL própria por registro, então
não sobrevive a um F5 nem dá link compartilhável. Para ter isso é preciso um
`GET /recurso/:id` na API — anotado como próximo passo, não esquecido.

### Dialog continua certo para confirmar

**Nunca monte um `<AlertDialog>` à mão.** Use um dos três, que já compartilham a
mesma forma:

| Componente                 | Quando                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `ConfirmActionDialog`      | confirmar qualquer ação, inclusive excluir. `infoItems` mostra o que está em jogo (nome → valor) |
| `DeleteConfirmationDialog` | exclusão com **impacto em cascata** ou em lote                                                   |
| `DiscardChangesDialog`     | sair de um formulário com alterações não salvas                                                  |

A forma mora em `alert-dialog.tsx`, não nos wrappers — mexer lá arruma os três
de uma vez. O padrão, vindo do Flag Field:

- **Rodapé sempre em linha**, os dois botões dividindo a largura. Não empilha no
  mobile: dois botões de meia tela cabem, e empilhado a ação destrutiva ficava
  bem sob o polegar.
- **Sem divisória** acima dos botões. O corpo é uma frase; a linha separava um
  parágrafo de dois botões e só somava peso.
- **Sem sombra nos botões.** O dialog já flutua — sombra ali é sombra sobre
  sombra, e o botão descolava do cartão.
- **Excluir NÃO é vermelho.** O botão de confirmação é `slate-800` mesmo em
  exclusão, pela mesma regra do resto do app: vermelho é alerta de estado
  (Vencido, saldo negativo), não rótulo de ação.
- **Anel de foco próprio** (`outline-none` + `focus-visible:ring-slate-300`).
  As classes desses botões são escritas à mão e **não** herdam de
  `buttonVariants`; sem isso o Radix foca um deles ao abrir e aparece o halo
  AZUL padrão do Chrome.

---

## 7. Tipografia e cor

- **14px é o mínimo.** Único abaixo disso: badge (12,5px / 500 / uppercase).
- **Um tamanho só por card.** Hierarquia vem do tom, não do corpo.
- **Tom por POSIÇÃO da linha:** primeira linha `slate-900`, segunda `slate-700`,
  apoio `slate-500`. Peso separa só a primeira linha da primeira coluna.
- **Cor nunca é o único código.** A faixa colorida do card de Recorrência diz o
  centro de custo; entrada x saída se lê no sinal `+`/`−` do valor.
- **Vermelho é ALERTA** (Vencido, saldo negativo) — despesa é neutra nos KPIs e
  nas listas. A exceção documentada é o gráfico Entradas × Saídas, onde o
  vermelho não classifica "ruim", só separa uma série da outra.
- **Contraste:** 4,5:1 para texto, 3:1 para elemento não textual. `emerald-600`
  dá 3,77:1 no branco e reprova como texto — use o 700 (5,48:1).

### Campos

Fundo **branco**, borda `slate-200`, sem sombra — o mesmo do Flag Field. O campo
se define pela borda, não por um fundo cinza; com fundo cinza, o modo leitura
precisava descer dois degraus para se diferenciar e a tela toda pesava.

### Separadores

**`·` não se usa.** O separador do app é o travessão `—`:
`INTERNET — Pessoal — Previsto`, `R$ 85,00 — dia 15`.

---

## 7b. Explicação fica no `(?)`, não na tela

Texto explicativo solto ocupa espaço permanente para uma informação que serve
UMA vez. Depois de lido, vira peso — e o app fica com cara de tutorial.

Use `<Ajuda>` (`components/ui/Ajuda.tsx`): um ícone discreto ao lado do título
ou do rótulo, que abre a explicação num cartão no centro da tela.

```jsx
<h2 className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
  Fora desta Fatura
  <Ajuda>Normalmente são compras feitas depois do fechamento.</Ajuda>
</h2>
```

Serve igual para RÓTULO DE CAMPO, e é aí que ele mais rende: um formulário com
um parágrafo cinza embaixo de cada campo fica duas vezes mais alto e desalinha
as colunas da grade, porque só alguns campos têm o parágrafo. O rótulo vira
flex e o ícone entra nele:

```jsx
<label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
  Dia do fechamento
  <Ajuda>A compra feita depois do fechamento cai na fatura seguinte.</Ajuda>
</label>
```

**Abre no CLIQUE, não no hover.** O app roda no celular, e um tooltip de hover
simplesmente não abriria lá. O Radix cuida de Esc, clique fora e teclado.

**É um dialog no CENTRO, sobre a tela desfocada** — não um balão ancorado no
ícone. O balão foi tentado primeiro e tinha dois defeitos que só aparecem em
uso: nascia grudado no título e ia sendo empurrado pela borda da tela, então a
mesma dica surgia num lugar diferente a cada vez; e no celular ele cobria
justamente a linha que estava explicando. O véu é `bg-slate-900/20` +
`backdrop-blur-sm`, e não o `bg-black/50` dos dialogs de verdade: o desfoque é o
efeito — some com a tela sem escondê-la —, e escurecer forte seria peso demais
para uma frase. O cartão é o `SUPERFICIE_TOOLTIP` que já existe, cinza quente,
que distingue "dica passageira" de "dialog com que se opera".

Dentro do cartão não vai ícone (repetir o do gatilho rouba a primeira linha do
texto) e o "Entendi" ocupa a largura toda, transparente com borda — é a borda de
baixo do cartão, e no celular um alvo de toque que não se erra.

**O ícone é `note-duotone`, em cinza.** Ele acompanha um título e não pode
competir com ele; escurece no hover para confirmar que é clicável. Um bloco de
nota, e não um `?`, é deliberado: `?` diz "não entendi isto"; nota diz "tem uma
observação aqui". O segundo é menos manual de instruções — que é justamente o
ponto, já que o objetivo do componente é a tela PARAR de parecer tutorial. De
quebra, deixa o ponto de interrogação livre para onde ele significa outra coisa
(o "não registrada" da fatura).

**Ele não desalinha o campo.** O `<Label>` do app é `leading-none` — 14px de
altura de linha para texto de 14px — e o botão do `(?)` tem 20px. Sem cuidado, a
linha do rótulo que tem `(?)` fica mais alta que a do vizinho e o campo abaixo
dela desce junto; numa grade de duas colunas isso salta aos olhos. O componente
resolve sozinho, com margem vertical negativa: ele contribui 14px para a linha e
transborda para onde não há nada, mantendo 20px de área de clique. Não copie o
botão à mão — use o componente, e o alinhamento vem junto.

**Uma ou duas frases.** O que não couber aí é documentação, não dica, e o lugar
dela é outro.

**O que NÃO vai para o `(?)`:** aviso que muda o que a pessoa deve fazer.
"Faltam R$ 300 nesta fatura" ou "sem cartão vinculado não dá para conciliar"
ficam à vista — esconder atrás de um clique é esconder o problema.

---

## 7c. Obrigatório leva `*`; opcional não leva nada

A regra é essa, e vale para o app inteiro. Antes convivia o oposto: vários
formulários escreviam "(opcional)" em quase todo rótulo. Isso é mais texto do
que informação — numa tela com seis campos e cinco "(opcional)", quem lê tem
que ler cinco vezes para descobrir qual é o único que importa. Com o `*`, a
exceção é que fica marcada, e ela é sempre a minoria.

Use `<Obrigatorio />` (`components/ui/Obrigatorio.tsx`), nunca um `*` digitado
à mão — foi assim que apareceram três estilos diferentes de asterisco no app.

```jsx
<Label htmlFor="nome">
  Nome
  <Obrigatorio />
</Label>
```

**Discreto de propósito:** mesma fonte e mesmo tamanho do rótulo, sem
sobrescrito, em cinza claro. Ele avisa, não grita — o rótulo continua sendo o
que se lê.

**Formulário de um campo só não leva marca.** O `*` serve para distinguir entre
campos; quando não há entre o que distinguir (trocar e-mail, definir senha), ele
não informa nada.

**Marque o que o código realmente exige.** Se o `*` está lá e o salvar passa sem
o campo, ou o contrário, o marcador vira ruído. Quando a obrigatoriedade for
condicional, o marcador também é — no formulário de recibo, por exemplo, o valor
só é obrigatório quando digitado à mão; no itemizado ele é a soma dos itens, num
campo somente-leitura.

---

## 8. Esqueleto para copiar

```jsx
export default function MinhaPagina() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>({});
  const [ordem, setOrdem] = useState<Ordem>("nome");

  const visiveis = useMemo(() => { /* filtra e ordena */ }, [/* ... */]);
  const filtrosNoPainel = /* conta só os campos do painel */;
  const temFiltroAtivo = filtrosNoPainel > 0 || busca.trim() !== "";
  const limparFiltros = () => { /* tudo, menos o mês */ };

  return (
    <div className="space-y-4">
      {/* 1 — busca + campos à vista + Filtros + Ordenar */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        <div className="grid flex-1 min-w-0 gap-2 grid-cols-1 sm:grid-cols-2">…</div>
        <Popover>…{PAINEL_ESCURO}…</Popover>
        <DropdownMenu>… Ordenar …</DropdownMenu>
      </div>

      {/* 2 — ações; UM botão escuro */}
      <header className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
        <Button variant="default" className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5")}>…</Button>
      </header>

      {/* 3 — contador + limpar */}
      <div className="flex items-center justify-end gap-1 px-1 min-h-[28px]">…</div>

      {/* 4 — conteúdo, sempre montado */}
      <div className={cn("transition-opacity duration-200", loading && "opacity-50 pointer-events-none")}>
        …
      </div>
    </div>
  );
}
```

---

## 9. Onde o padrão está de pé hoje

| Página               | Barra      | Ordenar | Botão escuro | Observação                                               |
| -------------------- | ---------- | ------- | ------------ | -------------------------------------------------------- |
| Lançamentos          | ✅         | ✅      | ✅           | referência; ver/editar inline                            |
| Recorrências         | ✅         | ✅      | ✅           | alinhada em 19/08/2026; ver/editar inline                |
| Relatórios           | ✅ parcial | —       | ✅           | usa os tokens; sem busca (não tem lista)                 |
| Dashboard            | ✅ parcial | —       | —            | período + centro; sem busca, por natureza                |
| Pendências           | ✅         | ✅      | ✅           | alinhada em 19/08/2026 (quadro de 3 colunas)             |
| Notificações         | ❌         | ❌      | —            | sem barra                                                |
| Admin › Organizações | ✅         | —       | ✅           | alinhada em 20/08/2026; ganhou busca                     |
| Equipe               | ❌         | ❌      | ❌           | sem barra                                                |
| Admin › Usuários     | ✅         | ✅      | ✅           | alinhada em 20/08/2026                                   |
| Configurações        | —          | —       | —            | HUB de atalhos (20/08/2026); absorveu as telas do master |

**Próxima candidata: Equipe** — tem lista e botão de criar, e não usa os tokens.

### Hub de atalhos

Conta e Configurações não são listas: são ÍNDICES. Em vez da barra, mostram
cards (3 por linha, ícone duotone colorido) que abrem o assunto inline, com
`Voltar` à esquerda e o nome do assunto à direita. Use quando a tela reúne
assuntos independentes — com abas, cada assunto novo espreme os títulos, e no
celular elas viram um `<select>` que esconde o que existe.

Pendências mostra que o padrão não exige tabela: é um quadro de três colunas, e
a barra funciona igual — a ordenação escolhida vale dentro de cada coluna, e o
contador soma as três.

---

## 10. Checklist antes de dar por pronta

- [ ] Nenhum `<h1>` — o breadcrumb é o título
- [ ] Ordenar ao lado de Filtros, não na linha de ações
- [ ] Exatamente um botão escuro, e ele é o de criar
- [ ] Rótulos de botão fixos e em Title Case
- [ ] Badge de Filtros conta só o painel
- [ ] Contador com `min-h-[28px]`
- [ ] "Limpar Filtros" limpa tudo menos o mês
- [ ] Carregando não desmonta o conteúdo
- [ ] Nada abaixo de 14px, exceto badge
- [ ] Nenhum `·` — separador é `—`
- [ ] Painel/menu escuro vem de `PAINEL_ESCURO`/`MENU_ESCURO`, não escrito à mão
- [ ] Classes vindas de `ui-tokens.ts`, não copiadas
- [ ] Criar/editar/ver é página inline, não dialog
- [ ] Ver é a tela de editar travada, não uma segunda tela
- [ ] Clique na linha abre em LEITURA
- [ ] Menu de ações com `stopPropagation`
- [ ] Linha clicável tem `role`, `tabIndex` e `onKeyDown`

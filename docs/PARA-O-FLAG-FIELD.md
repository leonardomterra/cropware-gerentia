# Dois padrões do gerentia para levar ao Flag Field

> Documento PORTÁTIL. Escrito para ser lido de dentro do repositório do Flag
> Field, por quem não acompanhou a conversa em que estas decisões nasceram.
> Data: 25/08/2026. Origem: `/Users/leonardoterra/Developer/cropware-gerentia`.

O gerentia adotou o design do Flag Field em agosto/2026 (ver
`docs/ADOCAO-DESIGN-FLAGFIELD.md`). Estes dois padrões nasceram DEPOIS, no
gerentia, e o caminho agora é o inverso.

**A stack bate.** Conferido em 25/08/2026: os dois usam React 18, Vite 6,
Tailwind v4, Radix, `src/components/ui/badge.tsx` e `src/lib/ui-tokens.ts` — e o
Flag Field já tem `SUPERFICIE_TOOLTIP`, `dialog.tsx` e `@radix-ui/react-dialog`.
**Única diferença que exige adaptação:** o gerentia usa `unplugin-icons`
(`import X from "~icons/ph/note-duotone"`) e o Flag Field usa
`@phosphor-icons/react` (`import { Note } from "@phosphor-icons/react"` com
`weight="duotone"`).

---

## 1. O `(?)` — explicação que fica guardada até alguém pedir

**Arquivo canônico:** `/Users/leonardoterra/Developer/cropware-gerentia/src/components/ui/Ajuda.tsx`
**Contrato completo:** o mesmo repositório, `docs/PADRAO-DE-PAGINA.md`, seção 7b.

### O problema

Texto explicativo solto ocupa espaço permanente por uma informação que serve UMA
vez. Depois de lido vira peso, e a tela fica com cara de tutorial. O caso que
originou isto: um formulário com um parágrafo cinza embaixo de quatro campos —
ele dobrava a altura da página e, pior, DESALINHAVA as colunas da grade, porque
só alguns campos tinham parágrafo.

### A solução

Um ícone discreto ao lado do título ou do rótulo. Ao clicar, abre um cartão no
CENTRO da tela, sobre o resto desfocado.

```jsx
<label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
  Dia do fechamento
  <Ajuda>A compra feita depois do fechamento cai na fatura seguinte.</Ajuda>
</label>
```

### As decisões, e por quê

**Clique, não hover.** O app roda no celular, onde hover não existe — um tooltip
de hover simplesmente não abriria. O Radix cuida de Esc, clique fora e teclado.

**Dialog no centro, não balão ancorado.** O balão foi tentado primeiro e tinha
dois defeitos que só aparecem em uso: nascia grudado no título e ia sendo
empurrado pela borda da tela, então a mesma dica surgia num lugar diferente a
cada vez; e no celular ele cobria justamente a linha que estava explicando.

**O véu é `bg-slate-900/20` + `backdrop-blur-sm`**, não o `bg-black/50` dos
dialogs de verdade. O desfoque é o efeito — some com a tela sem escondê-la — e
escurecer forte seria peso demais para uma frase.

**Usa as primitivas do Radix direto, não o `<Dialog>` do projeto.** O overlay
compartilhado é opaco e sem desfoque; mudá-lo alteraria todos os dialogs do app
para atender um caso só.

**Ícone `note`, duotone, em cinza.** Ele acompanha um título e não pode competir
com ele; escurece no hover para confirmar que é clicável. Um bloco de nota, e
não um `?`, é deliberado: `?` diz "não entendi isto"; nota diz "tem uma
observação aqui". O segundo é menos manual de instruções — que é o ponto, já que
o objetivo é a tela PARAR de parecer tutorial.

**Sem ícone dentro do cartão** (repetir o do gatilho rouba a primeira linha do
texto) e o **"Entendi" ocupa a largura toda**, transparente com borda: é a borda
de baixo do cartão, e no celular um alvo de toque que não se erra.

### A armadilha do alinhamento — leia antes de copiar

O `<Label>` do shadcn é `leading-none`: 14px de altura de linha para texto de
14px. O botão do `(?)` tem 20px. Sem cuidado, a linha do rótulo que tem `(?)`
fica 2px mais alta que a do vizinho e o campo abaixo dela desce junto; numa
grade de duas colunas isso salta aos olhos.

A correção mora NO COMPONENTE, com margem vertical negativa — ele contribui 14px
para a linha e transborda 3px para cada lado, onde não há nada, mantendo 20px de
área de clique:

```jsx
"shrink-0 inline-flex items-center justify-center size-5 rounded-full",
"-my-[3px]",
```

Corrigir assim, e não tela por tela, foi o que fez toda a adoção já existente se
alinhar sozinha.

### O que NÃO vai para o `(?)`

Aviso que muda o que a pessoa deve fazer. "Faltam R$ 300 nesta fatura" ou "ação
irreversível" ficam à vista — esconder atrás de um clique é esconder o problema.
O `(?)` leva o que COMPLEMENTA o aviso. Exemplo real: na Zona de Perigo, "Ação
Irreversível" e "Não dá pra desfazer" continuam visíveis; o `(?)` diz "antes de
excluir, gere e baixe um backup".

**Uma ou duas frases.** O que não couber aí é documentação, não dica.

---

## 2. Calibração dos selos (badges)

**Arquivos canônicos:** no gerentia, `src/components/ui/badge.tsx` e
`src/modules/dev/pages/BadgeLabPage.tsx` (rota `/badges`, só em DEV).

### O problema, com número

Os dois projetos fixaram a MESMA forma de selo — fundo 200, texto 900, sem borda
e sem sombra. Mas **"200" no Tailwind não quer dizer a mesma coisa em toda cor.**
Medindo em OKLCH o que o navegador realmente pinta:

| selo         | croma | vs. mediana |
| ------------ | ----- | ----------- |
| `yellow-200` | 0,129 | **1,70×**   |
| `lime-200`   | 0,127 | **1,67×**   |
| `amber-200`  | 0,120 | **1,58×**   |
| `teal-200`   | 0,096 | 1,28×       |
| `emerald-200`| 0,093 | 1,24×       |
| …            |       |             |
| `blue-200`   | 0,059 | 0,78×       |
| `rose-200`   | 0,058 | 0,76×       |

O selo âmbar tem o DOBRO da saturação de blue e red e, por ser também o mais
claro da paleta, brilha numa lista como se fosse de outro sistema. Não é
questão de gosto — é o único fora da faixa. E costuma ser o selo mais comum de
um app: "pendente", "trial", "atenção".

**O Flag Field tem exatamente as mesmas três linhas** (`amber-200`,
`yellow-200`, `lime-200` em `src/components/ui/badge.tsx`), então a correção é
literalmente a mesma.

### A correção

Preservar a MATIZ de cada amarelo e descer só o croma para 0,075 — a mediana da
família —, com a claridade alinhada em 0,914:

```ts
amber:  "bg-[oklch(0.914_0.075_95.746)] text-amber-900",
yellow: "bg-[oklch(0.914_0.075_101.54)] text-yellow-900",
lime:   "bg-[oklch(0.914_0.075_124.321)] text-lime-900",
```

Os três passam a medir 1,00× a mediana. Contraste com o texto 900 conferido:
7,05 / 6,76 / 6,90 : 1 — todos acima do AA.

**O valor vai em OKLCH, não em hexadecimal, de propósito.**
`oklch(0.914 0.075 95.746)` diz "mesma cor, na saturação da família";
`#f1e3aa` não diz nada a quem for mexer depois.

### Por que OKLCH e não HSL

Em HSL, amarelo e azul com o mesmo "L" parecem clarezas completamente
diferentes — a fórmula não modela a percepção. OKLCH modela: comparar croma
entre matizes só faz sentido nele.

### A ferramenta

`BadgeLabPage.tsx` não é vitrine de estilos (essa decisão já foi tomada). É uma
**ferramenta de medição**: lê a cor computada de cada selo, converte para OKLCH e
ordena a família por croma, marcando em vermelho quem está muito acima da
mediana. Registrar em DEV apenas, como já se faz com páginas de laboratório.

**Um detalhe que quase passou despercebido:** o Chrome devolve `oklch(...)` para
as cores nativas do Tailwind v4 e `rgb(...)` para um `bg-[#hex]`. A primeira
versão do medidor leu tudo como RGB e produziu números plausíveis e
completamente errados — o gráfico mentia sem parecer que mentia. O parser
precisa tratar os dois formatos (e `color(srgb ...)`). Está resolvido no arquivo
canônico; copie de lá.

### Ainda por fazer

`teal` (1,28×) e `emerald` (1,24×) também estão acima da faixa, mas bem menos.
Ficaram para depois nos dois projetos.

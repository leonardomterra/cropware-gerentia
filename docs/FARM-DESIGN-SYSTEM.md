# Cropware Farm — Design System

> Guia visual **próprio do Cropware Farm**. Alinhado ao Cropware CDM (Field),
> mudando apenas o brand (verde → slate). Antes de criar qualquer padrão novo,
> consultar o source do CDM em `../cropware/src` — a regra é "igualzinho" literal.
>
> Este documento descreve **o que** e **por quê**. A implementação vive em
> `src/app.css` + `src/components/ui/*`. Mantenha os dois sincronizados.
>
> Última atualização: 2026-05-30.

---

## 1. Princípio norteador

Farm deve ser **visualmente consistente com o Cropware CDM**. A única
diferenciação de marca é a cor (CDM = verde, Farm = slate) + a tagline
"Farm Data. Smart Decisions.". Estrutura, tipografia, espaçamentos,
componentes e padrões de interação são espelhados do CDM.

Quando houver dúvida visual, **ler o código do CDM primeiro** — não chutar.

---

## 2. Paleta

**Brand: SLATE.** Token `--color-farm-primary: #475569` (slate-600).

| Token | Hex | Uso |
|---|---|---|
| `farm-primary` | `#475569` (slate-600) | header, tab ativa, KPI de destaque |
| `farm-primary-dark` | `#334155` (slate-700) | linha inferior da tab ativa, gradientes |
| `farm-primary-darker` | `#1e293b` (slate-800) | confirmação destrutiva, gradiente botão |
| `farm-primary-darkest`| `#0f172a` (slate-900) | ação principal (botão default) |
| `farm-primary-light` | `#64748b` (slate-500) | sub-header, texto secundário |

HSL shadcn: `--primary: 215 19% 35%`. Radius global: **4px**.

**Fundos:** body `#ffffff`. Cards `bg-white`.

**Bordas:**
- Campos (input/select/searchable trigger) + popups (dropdown, select content,
  popover, command input): **`border-slate-100`** (clara).
- Cards e tabelas: **`border-slate-200`**.

**Focus:**
- Campos focados: `focus-visible:border-slate-300`.
- Botões: `focus-visible:ring-1 ring-slate-300 ring-offset-0`.

**Status (semântica universal, não usa brand):**
| Status | Cor |
|---|---|
| pago / recebido | emerald |
| a_pagar / a_receber | amber |
| vencido | red |
| cancelado | slate |

---

## 3. Tipografia

**Fonte:** Inter Tight Variable (`@fontsource-variable/inter-tight`) — mesma do CDM.

Body: 14px / weight 400 / `font-variation-settings: normal` / `letter-spacing: -0.015em` / antialiased.

**CRÍTICO — escala rem:** `html` = **16px**, `body` = **14px** (regras
separadas em `app.css`). Se setar `html: 14px`, `text-sm` (0.875rem) vira
12.25px e o app inteiro encolhe. **NUNCA setar html=14px.**

**Escala fixa — 4 tamanhos, não inventar outros:**
| Tamanho | Classe | Uso |
|---|---|---|
| 14px | `text-sm` (default) | parágrafos, labels, cells, botões, form fields, toasts |
| 13px | `text-xs` (remapeado de 12→13 via `--text-xs`) | complementar, section labels, headers de tabela, títulos de card |
| 16px | `text-base` | page h1, KPI value, título de dialog, CardTitle do auth |
| 12.5px | — | badges (override global) |

Exceções legítimas: OTP/código (`text-2xl/3xl font-mono`), logo wordmark,
ticks de chart (12px, é data-viz).

**Pesos:** 400 default · 300 (light) secundário/hints · 500 (medium) ênfase
rara (KPI, h1, section labels) · **600+ não usar**.

**Regras de texto:**
- **Sem CAIXA ALTA.** Guard global `.uppercase { text-transform: none !important }`
  neutraliza a utility. (Logo usa textTransform inline, fica de fora.)
- **Português sempre acentuado** em texto visível (Lançamentos, Você, Saídas).
  Código (vars/slugs/comentários) pode ser ASCII.

---

## 4. Badges

Override global `[data-slot="badge"]` em `app.css`: herda Inter Tight,
**12.5px / weight 300 / letter-spacing -0.01em / sem uppercase**.

- **Sempre Title Case PT-BR** — enforced no `badge.tsx` via `toSubtitleCase()`
  aplicado a filhos string diretos. JSX aninhado (`<span>{nome}</span>`) fica
  intacto (preserva nome próprio).
- Status: `<Badge colorScheme={...}>` (amber/emerald/blue/red/slate). Nunca
  span custom.

---

## 5. Botões (`ui/button.tsx`)

Paleta slate. Sempre `text-sm` (14px) `font-normal`.

| Variant | Bg | Uso |
|---|---|---|
| default | slate-900 → 800 | ação principal (Criar, Salvar, Entrar) |
| secondary | slate-100 → 200 | secundária |
| outline | white + border-slate-300 → slate-50 | cancelar / ação de lista |
| ghost | transparent → slate-100 | terciária / icon buttons |
| destructive | red-600 → 700 | excluir |
| link | underline | inline |

- **Confirmação destrutiva = slate-800, nunca vermelho** (só o trigger trash
  icon pode ser red).
- **Sem ícone por padrão** — exceções: Camera em "Capturar Recibo", Plus em
  "Novo X". Labels carregam o significado.
- Labels em **Title Case** (conectores curtos minúsculos: de, da, do, em, e, com…).
- **Altura fixa quando o conteúdo troca** (ex: label ↔ spinner): usar `height`
  fixo + `inline-flex items-center justify-center`, NUNCA padding vertical
  (o ícone de 16px é mais alto que a linha de 14px e cresceria o botão).

---

## 6. Dialogs (`ui/dialog.tsx` + `ui/alert-dialog.tsx`)

- **AlertDialog** (confirmação): `max-w-md`. Título `text-base` medium Title Case.
  Footer com `border-t border-slate-100` full-width + botões `*:flex-1` (50/50).
  Ação = slate-800, Cancel = slate-100.
- **Dialog de form** (ReceiptFormDialog, ReceiptViewDialog): `max-w-2xl`.
  `overflow-y-auto max-h-90vh`, footer não-sticky.
- **NÃO fecham ao clicar fora** — só X / Cancelar / ação explícita
  (`onInteractOutside preventDefault` por padrão). Vale pra todos.

---

## 7. Selects e dropdowns

| Componente | Quando usar |
|---|---|
| `ui/select.tsx` (Select simples) | ≤ ~4 opções (ex: Tipo despesa/receita) |
| `ui/searchable-select.tsx` | single-select com busca, listas médias/grandes |
| `ui/multi-searchable-select.tsx` | multi-select com busca + checkbox por item |

- Searchable = Popover + cmdk (Command). Items aceitam `group` (renderiza
  heading Title Case slate-500).
- **Dropdown buttons** (estilo CDM PlotManagement): seletor de CC + ordenação.
  `h-9 w-[Npx]` (**largura fixa**) `bg-slate-100 hover:bg-slate-200 rounded-md`,
  layout `ícone(shrink-0) | label(flex-1 truncate) | ChevronDown(shrink-0)`.
  Largura fixa evita o botão crescer/encolher conforme a seleção.
- **Popups + scroll:** searchable selects fecham o popup ao scrollar o
  `[data-app-scroll-container]` (via useEffect). Radix Floating UI não
  re-ancora bem quando o scroll vive num container interno. Também usam
  `side="bottom" avoidCollisions={false}`.

---

## 8. Tabelas (referência: `ReceiptsTable.tsx`)

Padrão CDM PlotManagement:
- Header branco, `border-b border-slate-200`, `text-sm font-medium py-3`.
  Larguras fixas por coluna (evita shift); coluna principal fica flex.
- Cells `py-3`. Hierarquia de cor: slate-700 (primary) → slate-600 (secondary)
  → slate-900 (emphasis/valor). Secundário em `text-xs slate-500`.
- Rows `border-b border-slate-200 last:border-b-0`. Selecionada = `bg-slate-50`.
- **Seleção em lote:** checkbox no header (select-all) + por linha. Pill
  "N selecionados" + Limpar na contagem. Seleção reseta quando filtros mudam.
- **Coluna Ações:** header "Ações" `text-right pr-4`. Botões outline
  `w-9 h-9 px-0 shadow-none` (Ver=Eye, Editar=Pencil, Excluir=Trash).
  Trash hover red-600 + bg-red-50 + border-red-200.
- Mobile: cards com dropdown de ações.

**Loading elegante:** separar initial load (card grande centrado com spinner)
de refetch (mantém conteúdo, `opacity-50 pointer-events-none transition`
+ spinner inline). Evita piscar ao trocar filtro.

---

## 9. Layout / AppShell

Container `max-w-[1600px] mx-auto`. Outer = `height: 100dvh` + `overflow-hidden`.

**Arquitetura de scroll (CRÍTICO):** o scroll vive no `<main>`
(`flex-1 min-h-0 overflow-y-auto` + `data-app-scroll-container` +
`scrollbar-gutter: stable`). O `min-h-0` é essencial (sem ele o overflow nunca
ativa). O **html NÃO pode ter `overflow-y: scroll` forçado** — isso cria uma
scrollbar de documento de 15px que o react-remove-scroll do Radix compensa com
padding, gerando "page squeeze" ao abrir Select/Dialog. `app.css` zera
`--removed-body-scroll-bar-size: 0px` + `padding/margin-right: 0` em html/body.

**Header** (bg slate-600, py-3 sm:py-4):
- Esquerda: `<Logo white />` (h-7 mobile, h-8 desktop) + divider + tagline.
- Direita: só **Ajuda + Sair** (GlassButton). Configurações foi pro menu;
  nome do usuário foi pro sub-header; trial badge não aparece.
- **Nunca usar `mr-N`/`ml-N` pra espaçamento** entre irmãos flex — sempre
  `gap-N` no pai. `gap-3` (12px) é o canônico.

**Sub-header** (bg slate-500, py-2): badges transparentes (usuário + org +
online). Offline = exceção com fundo escuro (alerta).

**Tab bar** (bg white, h-12): tabs `flex-1`. Active = solid slate-600 + linha
inferior 2px slate-700. Sem ícones. Itens: Dashboard · Lançamentos ·
(admin: Configurações, Recorrências, Equipe) · Conta.

**Breadcrumb** (`Layout/PageBreadcrumb.tsx`): barra branca abaixo da tab bar.
"Cropware Farm › <label>". Auto via useLocation.

**Roteamento:** rotas de verdade (URL muda por aba). Decisão consciente —
deep-link + refresh-na-tela-certa + back/forward funcionam. (O CDM usa state
em memória/URL fixa por escolha dele; não replicar.)

---

## 10. Padrão de página de lista (referência: `ReceiptsPage.tsx`)

Ordem vertical:
1. Breadcrumb (global, automático)
2. Barra de filtros
3. Action row (botões à **esquerda**: Novo / Capturar / Exportar)
4. KPIs
5. Contagem + tabela

Sem `<h1>` na página (o breadcrumb já diz o título). "Exportar" é dropdown
(CSV hoje, Excel/PDF depois).

---

## 11. Logo

Asset oficial **compartilhado com o CDM**: `public/logo-cropware.svg` (cópia de
`cropware/public/logo-e-name-cropware.svg`, cor nativa `#1A1A1A`).
`Logo.tsx` renderiza via `<img>`; prop `white` aplica
`filter: brightness(0) invert(1)`. **Não usar SVG inline custom** — a fonte do
wordmark é própria do CorelDRAW e não bate se redesenhada.

Tamanhos: header `h-8 white`, AuthLayout `h-7` (cor nativa).

---

## 12. Auth (AuthLayout + AuthScreen)

Shell de todas as telas: bg-slate-50, max-w-md, logo (sem tagline) + Card
shadcn (title 16px/600 + description slate-400). Login: "Acesse sua conta" +
Lembrar-me + "Esqueceu sua senha?" + botão Entrar (gradient slate-700→800,
height 46px fixo) + Criar Conta (outline). Espelho do CDM sem a coluna de
marketing.

---

## 13. Referência mestre do CDM

`../cropware-design-system.md` (na raiz, 1131 linhas) — guia completo do CDM
(Field). Consultar antes de criar padrão novo. Este FARM-DESIGN-SYSTEM.md é o
recorte/adaptação para o Farm.

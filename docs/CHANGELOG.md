# Changelog — Cropware Farm

> Mudanças notáveis por data. Formato baseado em
> [Keep a Changelog](https://keepachangelog.com). Para a visão de produto
> (o que está feito / pendente), ver `FARM-ROADMAP.md`.
>
> O Farm ainda não usa versionamento semântico formal — as entradas são
> agrupadas por data até o primeiro release público.

---

## 2026-05-30

### Adicionado
- **Aba Configurações** com sub-tabs Centros de Custo + Categorias (substituiu
  a aba "Centros"; `/centros` redireciona pra `/configuracoes`).
- **Categorias custom por usuário** + ocultar presets por organização
  (migration `farm_categories_custom`: `created_by_user_id` + tabela
  `farm_category_hidden` + RLS). CRUD completo no gerenciador.
- **52 presets de categoria** agrupados (Fazenda/Pessoal/Escritório/Viagem/
  Financeiro/Receitas), com `group_name`.
- **Multi-select com busca** (Status, Categoria) na barra de filtros de
  Lançamentos. Edge function `farm-api` aceita CSV em `status`/`category`.
- **SearchableSelect** e **MultiSearchableSelect** (Popover + cmdk).
- **Breadcrumb global** abaixo da tab bar ("Cropware Farm › …").
- **Seleção em lote** + botão Ver + dialog de detalhes na tabela de Lançamentos.
- **Pivot CC-only**: signup neutro (não-rural), seedeia 3 Centros de Custo.

### Alterado
- Tela de **login** espelhada do CDM (paleta slate, gradient no botão Entrar).
- **Header**: nome do usuário foi pro sub-header; botão Configurações saiu;
  badges transparentes.
- Tabela de Lançamentos no padrão **CDM PlotManagement**.
- Barra de filtros: sem títulos nos campos, bordas mais claras, dropdowns de
  CC + ordenação com largura fixa.
- "Fazendas" escondido do menu (CRUD órfão; rota mantida).
- Acentuação correta em **todo texto visível** (i18n PT-BR).

### Corrigido
- **Page-squeeze** ao abrir Select/Dialog (scrollbar forçada no html removida).
- Scroll do mouse no `<main>` (shell 100dvh + `min-h-0`).
- Botão Entrar não cresce mais ao carregar (altura fixa).
- Popup de searchable select não cobre mais o cabeçalho ao rolar.

---

## 2026-05-28

### Adicionado
- **Logo** reusa o asset oficial do CDM (`public/logo-cropware.svg` via `<img>`).
- Polimento do bot WhatsApp: pergunta CC quando ambíguo, pergunta data quando
  não extrai, histórico de 12 turnos de conversa.

### Alterado
- Fonte sincronizada com o CDM (**Inter Tight**); badges sem JetBrains Mono e
  sem caixa alta (12.5px / Title Case).
- Escala tipográfica fixa (14/13/16) via tokens `@theme`.

---

## 2026-05-27

### Alterado
- Migração de brand **laranja → slate**, alinhado ao Cropware CDM.
- Header de ponta a ponta + nav horizontal + dialogs padronizados (sem fechar
  ao clicar fora) + botões slate sem ícone por padrão.

---

## Até 2026-05-28 (resumo das rodadas R1–R3)

### Adicionado
- **R1**: áudio no WhatsApp, marcar conta como paga via bot, lançamentos
  recorrentes (cron diário).
- **R2**: dashboard com gráficos (recharts), exportação CSV.
- **R3**: alertas de vencimento + resumo semanal (código), perguntas sobre
  Centro de Custo e data no bot.
- RBAC (owner/admin/member), convites por código, Centros de Custo.

### Fundação (V1)
- Scaffolding Vite + React + TS + Tailwind v4 + shadcn/ui.
- Auth Supabase multi-tenant + RLS.
- CRUD de lançamentos + captura de recibo por foto (OCR Gemini).

# Auditoria pré-lançamento — gerentia.app

Auditoria em **5 etapas**, feita antes do lançamento oficial. Cada etapa gera
achados (por severidade) + correções. Status no topo de cada seção.

- [x] **Etapa 1 — Segurança** ✅ FECHADA (correções deployadas + RLS endurecido + segredos rotacionados)
- [x] **Etapa 2 — Robustez / pontos de erro** ✅ corrigida
- [x] **Etapa 3 — Visual / UI + a11y** ✅ auditada + corrigida (alto + médios baratos)
- [x] **Etapa 4 — Mobile / responsividade** ✅ auditada + corrigida (1 item adiado: H2)
- [ ] **Etapa 5 — Capacitor (Android/iOS)**

---

## Etapa 1 — Segurança  ✅ auditada

Auditoria por 3 frentes (auth/edge, RLS/SQL, segredos/exposição). Resumo:

### 🔴 Crítico / Alto
1. **Segredo do cron em texto puro** (`farm_alerts_2026_x9k2p3m7`) nas migrations
   `20260528160000`, `20260528170000`, `20260612120000` e em
   `docs/FARM-MIGRATION-NEW-PROJECT.md`. Protege `/cron/*`. → rotacionar + ler do
   **Vault** no pg_cron + limpar doc (segue no histórico do git → rotação resolve).
2. **`users_meta` UPDATE sem `WITH CHECK`** → membro pode se auto-promover a
   owner/admin ou trocar o próprio `organization_id` (escalonamento). → `WITH CHECK`.
3. **Webhook WhatsApp fail-open** — processa payload sem assinatura se
   `WHATSAPP_GERENTIA_APP_SECRET` ausente. → fail-closed.

### 🟠 Médio
- `/admin/list-templates` e `/submit-templates` autenticados por `?key=` na URL → `requireMaster`.
- `/webhook/salvy-sms` grava no banco sem auth.
- `DELETE /members/:userId` no-op silencioso + sem filtro de org.
- `DELETE /recurring/:id` roda cleanup admin antes de checar dono.
- Verify token do Meta + IDs no doc → rotacionar + limpar.
- CORS fail-open `*` se `GERENTIA_ALLOWED_ORIGINS` ausente (risco baixo: Bearer, não cookie).
- `farm_categories` INSERT não fixa `organization_id`; faltam `set search_path` em
  `farm_user_can_access_cc` e `farm_cc_check_limit`; faltam `.eq(organization_id)`
  defensivos em mutações `:id`.

### 🟡 Baixo
- `attachment_key` aceito do cliente sem validar prefixo `org-<org>/`.
- OCR/scan + suggest-category sem rate-limit (custo Gemini/R2).
- `.or()` do PostgREST com interpolação sem escape (RLS protege).
- Proxy `gemini` fail-open se faltar `GERENTIA_INTERNAL_SECRET`.
- Logs com conteúdo de SMS/args (PII em logs internos).
- Código de vínculo WhatsApp (6 díg.) sem limite de tentativas.

### ✅ Bem feito
RLS em todas as tabelas; anexos RLS-scoped; nenhum segredo de API/service_role
commitado; `.env` fora do git; client web só anon key; rotas DEV gated; comparação
de segredo em tempo constante; funções de recorrência só service_role; bucket
privado; signup/invites sem entrar em org arbitrária.

### Correções — código ✅ FEITO (deployado)
- [x] WhatsApp webhook **fail-closed** (whatsapp.ts)
- [x] `salvy-sms` exige `x-salvy-secret` + sem PII no log (whatsapp.ts)
- [x] POST /receipts valida prefixo do `attachment_key` (receipts.ts)
- [x] DELETE /members via admin scoped ao org (members.ts)
- [x] DELETE /recurring confirma posse antes do cleanup (recurring.ts)
- [x] /admin/*-templates via `requireMaster` (cron.ts)
- [x] rate-limit por usuário no OCR/suggest (receipts.ts)
- [x] users_meta **WITH CHECK** (migração `20260621120000`, aplicada)
- [x] `search_path=''` em farm_user_can_access_cc / farm_cc_check_limit (idem)
- [x] farm_categories INSERT fixa organization_id (idem)
- [x] cron via Vault: migração `20260621130000` **aplicada** (jobs leem do Vault).

### Correções — rotação
1. [x] **Cron secret** (Crítico) — ROTACIONADO: valor novo no Vault
   (`gerentia_cron_secret`), `GERENTIA_CRON_SECRET` atualizado (digest novo),
   jobs lendo do Vault (sem literal), `FARM_CRON_SECRET` legado removido. O valor
   antigo não autentica mais.
2. [x] **WhatsApp verify token** — ROTACIONADO (Meta + env atualizados; digest novo).
3. [x] **Confirmados setados em prod**: `GERENTIA_ALLOWED_ORIGINS`,
   `WHATSAPP_GERENTIA_APP_SECRET`, `GERENTIA_INTERNAL_SECRET` ✅. `GERENTIA_SALVY_SECRET`
   não setado → endpoint salvy-sms fica fail-closed (inerte; setar só se for usar).
4. [x] **Literais limpos** de `docs/FARM-MIGRATION-NEW-PROJECT.md` (cron secret,
   verify token, IDs). Obs: continuam no histórico do git → a rotação é o que resolve.

### Não corrigido (aceito por ora — risco baixo)
- `.or()` do PostgREST com interpolação (RLS protege; validar slugs depois).
- Proxy `gemini` fail-open se faltar `GERENTIA_INTERNAL_SECRET` (confirmar setado).
- Brute-force do código de vínculo WhatsApp 6 díg. (TTL + 1 código ativo mitigam).
- `.eq(organization_id)` defensivo extra em mutações `:id` (RLS já cobre).

---

## Etapa 2 — Robustez / pontos de erro  ✅ auditada + corrigida

### Corrigido
- [x] **Agente WhatsApp não baixa PREVISTO** (`mark_receipt_paid` exclui is_estimated).
- [x] **pending.extracted guardado** (savePhotoReceipt + cw_pay) — sem crash/save perdido.
- [x] **PATCH de itens com restore** (troca itens antes do header; restaura antigos
  se a inserção falhar) — não deixa itemizado sem itens.
- [x] **Cap de 200 itens**; **filtro de categoria/CC sanitizado** no `.or()`; **onError
  não vaza** err.message.
- [x] **Dashboard: previsto fora do realizado** (Entradas/Saídas, Onde Mais Saiu,
  Gastos por Centro, mês anterior, barras realizadas) — segue em A pagar/A receber
  + projeção. (decisão do usuário)
- [x] **CC derivado dos itens** em Próximos vencimentos / projeção (itemizado tinha
  CC nulo no header e sumia sob filtro de centro).
- [x] **sortedReceipts** com `default` (sem tela branca); **blob revogado** no Imprimir
  de Anexos; **pop-up bloqueado** tratado nos Relatórios; **STATUS_COLOR_SCHEME**
  com fallback; **CSV usa data efetiva** (paid||transaction).

### Aceito / adiado (risco baixo)
- Duplo-clique em alguns "managers" (categorias/CC/recorrências) sem trava →
  toast de erro espúrio (idempotente). `AlertDialogAction` fecha antes do async
  (guard `disabled` cosmético).
- **Anexos órfãos no R2** em scan/foto abandonado → falta um GC (cron) — anotar p/ depois.
- OCR não valida enums antes de salvar; base64 decodificado antes do cap; dedup/
  rate-limit in-memory (multi-instância); lazyWithRetry sem quebra-loop.

### ✅ Bem feito
reqId guard (useReceipts/useAttachmentUrl); flags resetadas em finally; rollback no
POST itemizado; promovidos/counts_in_total excluídos consistentemente; idempotência
mensal da recorrência; TZ São Paulo DST-safe; formatters defensivos.

## Etapa 3 — Visual / UI + a11y  ✅ auditada + corrigida

Duas frentes (consistência/estados + acessibilidade). App já bem polido no geral.

### 🔴 Alto — CORRIGIDO
- [x] **Botão "Ver" (olho) morto** nos cards de Centro de Custo (`onClick={()=>{}}`) → removido.
- [x] **Estado vazio no desktop** era linha de "—" apagada → mensagem central (`emptyLabel`)
  na tabela (`ReceiptsTable` colSpan). `emptyLabel` propagado de `ReceiptsListPage`.
- [x] **Vazio no mobile** fixo "Nenhum lançamento" → usa `emptyLabel` (certo em Anexos/Faturas/Notas).
- [x] **A11y teclado:** linhas de "Próximos vencimentos" e badge "Desmembrado" eram clique-only
  → `role=button` + `tabIndex` + `onKeyDown` (Enter/Espaço) + anel de foco.

### 🟠 Médio — CORRIGIDO (baratos)
- [x] **Cards mobile: despesa em `rose`** → `slate` (despesa = neutro; vermelho só p/ alerta).
- [x] **Dashboard sem sinal "−"** na despesa → `{income ? "+" : "−"}` (consistente c/ a lista + a11y).
- [x] **Botão da conta (sidebar) sem anel de foco** → `focus-visible:ring`.
- [x] **Título da aba não mudava por rota** → `document.title` por rota no AppShell.
- [x] **KPI de Relatórios sem truncate** → `truncate`/`min-w-0` (não estoura com valor grande).

### 🟡 Adiado (refactor / baixo valor) — para depois
- Adotar `EmptyStateCard` + skeleton **app-wide** (hoje 5 tratamentos de vazio/loading divergentes;
  uns mostram `<p>Carregando...</p>` cru).
- **Associar labels** a todos os Select/SearchableSelect/MultiSelect (leitor de tela não anuncia o
  nome) — padrão difundido (ReceiptFormDialog, RecurringPage, ReceiptFiltersBar, CategoriesManager).
  Caminho barato: prop `aria-label` no trigger do SearchableSelect + nos `SelectTrigger`.
- Trocar `confirm()`/`alert()` nativo por dialog estilizado (RecurringPage, CostCentersManager,
  AdminUsers) — quebra visual do design system.
- Consolidar os 2 sistemas de botão de toolbar (Button `h-9 rounded` vs hand-rolled
  `bg-slate-100 rounded-md`); usar `ActionIconButton` nos 3 managers que reimplementam.
- Ellipsis "..." → "…"; spacing de ícone (`mr-1`/`mr-1.5` vs `gap`); AdminUsers "+" → ícone `Plus`.
- Contraste `text-slate-400` em infos reais do Dashboard → `slate-500/600` (L4).
- `accessibilityLayer` nos charts; skip-link p/ `<main>`; `<dl>` + `alt` contextual no PDF.
- `CostCentersPage` standalone duplicado (legado) → confirmar rota e deletar (ver rebrand-cleanup).

### ✅ Bem feito (sem mudança)
Badges/status disciplinados (STATUS_COLOR_SCHEME); erros uniformes (`bg-red-50`); cards padrão;
títulos h1 consistentes; `tabular-nums` nos valores; `ActionIconButton` força `aria-label`;
dialogs Radix (foco/Esc, sr-only no X); MonthSwitcher/kebab/nav com `aria-label`; PDF bem
estruturado (`lang`/`title`); AttachmentViewer com os 4 estados; `index.html` com `lang=pt-BR`.

## Etapa 4 — Mobile / responsividade  ✅ auditada + corrigida

Duas frentes (layout/overflow + toque/inputs/fluxos). `isMobile` = 768px
(`use-mobile.ts`, alinha com `md:`). App já bem responsivo (cards no lugar de
tabela <768, safe-areas no dialog/alert/dropdown, anti-zoom `text-base md:text-sm`,
datas nativas, inputMode decimal no dinheiro).

### 🔴 Alto — CORRIGIDO
- [x] **X de fechar do dialog escondido no mobile** (`hidden sm:flex`) + clique-fora
  desativado → beco sem saída. Removido o `hidden sm:flex` (X aparece sempre, 44px).
- [x] **Viewer de PDF = `<iframe>` cru** (branco em WebView) → no mobile mostra card
  "Abrir PDF" (anchor `target=_blank`, mais confiável que window.open).

### 🟠 Médio — CORRIGIDO
- [x] **Kebab dos cards 28px** (`size-7`, única ação por linha no mobile) → `size-9` + ícone `size-5`.
- [x] **`ReceiptItemsTable` sem scroll** → envolto em `overflow-x-auto` + `min-w-md` (não estoura no dialog).
- [x] **Abas de Configurações sem scroll** → `overflow-x-auto` + `whitespace-nowrap shrink-0`.
- [x] **Botão "Sugerir" minúsculo** → bump sutil de toque (`py-1 min-h-6`) sem descaracterizar a marca.
- [x] **Setas de ano do month picker 28px** → `size-9`.
- [x] **`type=number` em Recorrências** (dia/meses) → + `inputMode="numeric"` (teclado certo).

### 🟡 Adiado / aceito
- **H2 — Imprimir/PDF dos Relatórios sem fallback de download no mobile**
  (`openReportPage`/`handlePrintWithAttachments` usam `window.open`+`print()`; o merge de
  anexos já tem fallback `<a download>`). Fallback real exige gerar PDF (pdf-lib) p/ baixar
  em vez de imprimir no touch → fazer numa sub-fase (provável overlap com Etapa 5/Capacitor).
- **TeamPage** tabela sem fallback mobile — Equipe está **desativada** (nav comentado);
  só vira problema se reativar (modelo individual hoje). Anotado.
- Tooltips de chart só hover (info redundante em KPIs/labels); dia/meses poderiam ser
  `inputMode` puro (já melhorado).

## Etapa 5 — Capacitor (Android/iOS)  ⏳ pendente

Escopo:
- Existe config Capacitor? (capacitor.config, plugins, projetos android/ios). Hoje
  o app é web puro — mapear o que falta.
- Câmera/galeria nativa (hoje usa input file + compressão WebP no browser).
- Storage/arquivos, share, abrir PDF (window.open/print no WebView).
- Deep links / OAuth redirect / Supabase auth no WebView.
- Safe areas, status bar, splash, ícones, permissões.
- Impressão/Salvar PDF no WebView (window.print pode não existir) — alternativa.
- Build/assinatura, variáveis de ambiente no app nativo.

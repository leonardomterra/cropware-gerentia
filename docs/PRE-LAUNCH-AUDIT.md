# Auditoria pré-lançamento — gerentia.app

Auditoria em **5 etapas**, feita antes do lançamento oficial. Cada etapa gera
achados (por severidade) + correções. Status no topo de cada seção.

- [x] **Etapa 1 — Segurança** (achados abaixo; correções de código em andamento)
- [ ] **Etapa 2 — Robustez / pontos de erro**
- [ ] **Etapa 3 — Visual / UI**
- [ ] **Etapa 4 — Mobile / responsividade**
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

### Correções
**Código (eu faço):** WITH CHECK users_meta · WhatsApp fail-closed · salvy-sms auth ·
member delete (org/scoped) · recurring delete checa dono · validar prefixo
attachment_key · admin-templates requireMaster · cron via Vault · search_path
helpers · rate-limit OCR · farm_categories INSERT pin org.

**Rotação (o usuário faz):** novo `GERENTIA_CRON_SECRET` (criar no Vault como
`gerentia_cron_secret`) · novo `WHATSAPP_VERIFY_TOKEN` · confirmar setados em prod:
`GERENTIA_ALLOWED_ORIGINS`, `WHATSAPP_GERENTIA_APP_SECRET`, `GERENTIA_INTERNAL_SECRET`.
Limpar literais de `docs/FARM-MIGRATION-NEW-PROJECT.md`.

---

## Etapa 2 — Robustez / pontos de erro  ⏳ pendente

Escopo a auditar:
- Tratamento de erro nas chamadas de API (frontend): toasts, estados de erro,
  retry; promessas sem catch; `void` em async.
- Edge cases de dados: null-safety (campos opcionais), divisão por zero (%),
  listas vazias, valores muito grandes, datas inválidas.
- Condições de corrida: refetch concorrente (já há reqId em useReceipts — checar
  os demais hooks), duplo-submit em dialogs, duplo-clique em ações.
- Integridade: itemizado vs header (total derivado), desmembrado, counts_in_total
  em todas as agregações; recorrências (materialização/limpeza).
- Edge backend: erros não tratados, `onError`, respostas de erro consistentes.
- Uploads: limites, mimes, falha de R2, OCR retornando lixo.

## Etapa 3 — Visual / UI  ⏳ pendente

Escopo:
- Consistência de badges/botões/cores (já padronizado — revisar exceções).
- Estados: vazio, carregando, erro, "sem permissão".
- Textos longos (vendor/descrição/categoria) — truncamento/overflow.
- Tabelas com muitos itens; números grandes (alinhamento tabular).
- Dark mode? (verificar se existe/é suportado).
- Acessibilidade básica (foco, aria em ícones-botão, contraste).

## Etapa 4 — Mobile / responsividade  ⏳ pendente

Escopo:
- Layouts em telas estreitas (lista→cards, dialogs, toolbars que já foram
  ajustadas — revisar Relatórios, Anexos, Configurações, Admin).
- Alvos de toque (≥40px), scroll horizontal acidental.
- Safe areas (notch) — já há env(safe-area-*) no dialog; revisar telas.
- Teclado virtual cobrindo inputs; inputs de data/valor no mobile.
- Visualizador de anexo e impressão no mobile.

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

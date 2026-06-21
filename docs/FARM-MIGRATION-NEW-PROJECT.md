# Migração — gerentia.app para projeto Supabase dedicado

**Data:** 2026-06-02 · **Status:** ✅ concluída (core validado E2E)
**De:** `tzsmxhwvtobwkqffgsxo` (compartilhado com o Studio)
**Para:** `ttnsywnwjybrrtykoqxr` (nome "gerentia", **sa-east-1**, plano **FREE**, org "Cropware Farm" `bznnmmxuqbpuepgxqbgw`)

> Dados antigos eram só teste → descartados. Projeto novo nasceu limpo (`auth.users` zerado).

---

## Por que / como

- Compartilhar com o Studio misturava `auth.users` e complicaria o futuro painel master.
- **Separação saiu R$ 0:** org nova no FREE hospeda o projeto sem custo (não precisou do +$10/mês).
- Região **sa-east-1** de propósito (o projeto FREE iniciado antes estava em us-west-1, errado p/ BR, e foi descartado — região não muda após criar).
- **Caveat FREE:** pausa após ~7 dias sem atividade; sem backup automático diário.

---

## O que foi feito (ordem real)

1. **Criado** o projeto `gerentia` (Region: São Paulo; Enable automatic RLS ligado).
2. **Função `gemini` própria** — `supabase/functions/gemini/index.ts`. Desfez o acoplamento com o Studio (antes `lib/gemini.ts` chamava o proxy `gemini` do Studio). Deploy + secret `GOOGLE_AI_KEY`.
3. **URLs de cron repontadas** nas migrations `..._farm_due_alerts.sql` e `..._farm_weekly_summary.sql` (estavam com o host antigo cravado) → ref novo.
4. **`db push`** das 23 migrations (`pg_cron`/`pg_net` criados pelas próprias migrations). Verificado com `migration list`.
5. **`farm-api` deployado** com **`--no-verify-jwt`** (tem webhooks públicos WhatsApp/cron).
6. **Frontend repontado** — só `src/utils/supabase/info.ts` (projectId + anonKey); `client.ts` e `api.ts` derivam dali.
7. **Auth config** (dashboard): Site URL `https://gerentia.app`; Redirect URLs incluem `http://localhost:3000` (porta do Vite) + `https://gerentia.app/**`; "Confirm email" desligado no piloto.
8. **Secrets** setados (ver abaixo).
9. **Validação E2E:** signup → trigger `handle_new_user` (org + CCs) → `/auth/me` → app carregou. ✅

---

## Secrets do projeto novo (Edge Functions → Secrets)

| Secret | Para quê | Origem do valor |
|---|---|---|
| `GOOGLE_AI_KEY` | função `gemini` (OCR/IA) | Google AI Studio |
| `GERENTIA_CRON_SECRET` | autentica cron (alertas/resumo) | **rotacionado** — guardado no Vault (`gerentia_cron_secret`); os jobs leem de lá (não hardcodar) |
| `GERENTIA_R2_ACCOUNT_ID` | endpoint R2 | Cloudflare (dashboard) |
| `GERENTIA_R2_BUCKET_NAME` | bucket de anexos | `gerentia-receipts` |
| `GERENTIA_R2_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | upload/download de recibo | R2 API Token (Cloudflare → R2 → Manage API Tokens) |
| `WHATSAPP_VERIFY_TOKEN` | verificação do webhook | definido por você (Meta + env) — **rotacionar**; não versionar |
| `WHATSAPP_GERENTIA_BOT_WABA_ID` / `_PNID` | identificadores Meta | ver no Meta (App → WhatsApp) |
| `WHATSAPP_GERENTIA_BOT_TOKEN` | enviar msg Cloud API | system user permanente do app Meta (ver no Meta) |
| `WHATSAPP_GERENTIA_APP_SECRET` | assinatura HMAC do webhook | App Meta → Settings → Basic |

> `SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` são **auto-injetados** — não setar.
> Anexos vão pro **Cloudflare R2**, não pro Storage do Supabase (bucket `farm-receipts` da migration é vestigial).

---

## Operação CLI / MCP (lições)

- CLI via `npx supabase` (instalado como devDep). `db push`/`migration list` usam `link` + senha do banco.
- `secrets`/`functions deploy` exigem **`SUPABASE_ACCESS_TOKEN`** no env (ou usar o painel de Secrets do dashboard, que dispensa o token). Persistir: `[System.Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN","sbp_...","User")` + **terminal novo**.
- **MCP do Supabase NÃO alcança este projeto** (token do MCP é de outra org). Usar CLI/dashboard.

---

## Pendências

- [ ] **Repontar o webhook do WhatsApp no Meta** (App Meta → WhatsApp → Configuration → Webhook): Callback `https://ttnsywnwjybrrtykoqxr.supabase.co/functions/v1/gerentia-api/webhook/whatsapp`, Verify Token = o valor de `WHATSAPP_VERIFY_TOKEN` (não versionar aqui), reinscrever campo `messages`.
- [ ] **Testar upload de recibo** (R2 agora configurado).
- [ ] **Deploy do frontend** em gerentia.app (Cloudflare Pages) — domínio registrado, ainda não hospedado.
- [ ] Considerar **keep-alive** se o FREE pausar; ou subir pra Pro quando houver atividade real.

---

## Criar usuário direto no Supabase (gotcha)

O trigger `handle_new_farm_user` **só roda se `raw_user_meta_data` tiver `farm_signup`**. Criar usuário pelo dashboard sem isso → nasce **sem organização** (não entra no app). Pelo dashboard, preencher User Metadata: `{ "farm_signup": true, "farm_name": "...", "full_name": "..." }`. O futuro painel master fará isso server-side.

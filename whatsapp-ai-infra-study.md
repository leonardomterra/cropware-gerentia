# Estudo: infra de IA/WhatsApp do CDM → trazer pro Cropware Farm

**Data:** 2026-05-27
**Contexto:** mapear como o **Cropware CDM** (`C:\Cropware\cropware`) implementa os robôs de
IA via WhatsApp + o pipeline de classificação de documentos por IA + o armazenamento de
imagens, e planejar como replicar/adaptar isso no **Cropware Farm**. Companheiro do
[salvy-whatsapp-migration-study.md](salvy-whatsapp-migration-study.md) (número via Salvy).

---

## TL;DR

1. **O bot de serviços do CDM é WhatsApp Cloud API (Meta) puro** — não usa plataforma
   terceira. Arquivos com prefixo `telegram-*` no backend são legado de nome; rodam no
   WhatsApp. Núcleo: OpenAI **function calling** (gpt-5.4-mini) com ~30 tools, histórico de
   conversa em KV, áudio via Whisper, **imagem via Gemini Vision**, PDF nativo no gpt-5.
2. **A "joia" que você quer (classificar recibo/nota por IA) JÁ EXISTE no Farm** —
   `POST /farm-api/receipts/scan` sobe a imagem pro Supabase Storage e extrai campos via
   Gemini. Trazer isso pro WhatsApp é **reaproveitar `extractReceiptFromImage` no webhook**,
   não construir do zero.
3. **Armazenamento: R2 dedicado (DECIDIDO 2026-05-27).** O commit 8 tinha ido pra Supabase
   Storage, mas a decisão é migrar pra **Cloudflare R2 em bucket dedicado**
   (`cropware-farm-storage`) — mais espaço e flexibilidade que o Storage do Supabase no longo
   prazo. **Diferença vs CDM:** o bucket do CDM (`cropware-storage`) é **público** via domínio
   (`storage.cropware.com.br`), o que serve pra foto de campo mas **não pode** pra documento
   fiscal (CNPJ, valores). Logo o Farm usa **R2 privado + presigned URLs** (geradas pelo
   `aws4fetch`), preservando o modelo de signed-URL que o Storage já tinha. Sem crop (documento
   não se croppa); padronização leve = compressão client-side antes do upload.
4. **Salvy não entra no caminho da mensagem.** Salvy só fornece o número (SIM virtual MVNO) e
   entrega o SMS de verificação via webhook. O envio/recebimento de mensagens e mídia continua
   100% Meta Cloud API — idêntico ao CDM. O `PNID filter` (já desenhado no stub do Farm)
   garante coexistência na mesma WABA.
5. **O webhook do Farm hoje é stub** (`handlers/whatsapp.ts` responde 501 "commit_9"). O GET
   de verificação Meta já funciona. Falta: POST real, vínculo de conta, dispatch por tipo.

---

## 1. Como o CDM faz hoje (mapa da infra)

### 1.1 Dois bots, uma WABA, separados por PNID

| Bot | Número | Webhook | Função |
|---|---|---|---|
| **Services Bot** | +55 64 9329-8381 ("Cropware") | `/make-server-875c00b5/whatsapp-webhook` | Atende assinantes: registra atividades, consulta dados, analisa fotos/PDF, clima, NDVI |
| **Leads Bot** | +55 64 99329-8295 ("Cropware Comercial") | `/make-server-875c00b5/whatsapp/lead-webhook` | Qualifica leads de anúncios/site, state machine, handoff comercial |

Ambos vivem na **mesma WhatsApp Business Account**. Cada webhook filtra por
`entry[0].changes[0].value.metadata.phone_number_id` (PNID) e **ignora silenciosamente**
(200 `{ignored:true}`) o que não é dele. Isso é o que permite múltiplos bots/produtos numa
WABA só — e é exatamente o mecanismo que o Farm vai usar pra coexistir.

### 1.2 Anatomia do webhook do Services Bot (`index.ts`)

Padrões que valem ouro e devem ser copiados:

1. **PNID filter** (linha ~12920) — ignora webhooks de outros números.
2. **Deduplicação de mensagens** — Meta reenvia se resposta demora >20s; mantém `Map` de IDs
   recentes (`recentMessageIds`) e pula duplicatas.
3. **Background processing** — responde 200 imediato e processa em `EdgeRuntime.waitUntil()`.
   IA + DB + envio outbound passam de 20s; sem isso a Meta retenta e duplica.
4. **Safety net por mensagem** — `try/catch` individual: o bot **nunca fica mudo**, sempre
   manda uma mensagem de erro contextual (por estágio: download/upload/kv/menu).
5. **Comandos universais** (`menu`, `limpar`, `recomeçar`, `reset`) interceptados ANTES de
   qualquer fluxo — escape hatch mesmo com estado inconsistente.
6. **Rate limit por telefone** (`checkWhatsAppRateLimit`).
7. **Dispatch por `msg.type`**: `text` | `interactive` (button_reply/list_reply) | `audio` |
   `image` | `document` | `location`.

### 1.3 Vínculo de conta (account linking)

- App web gera **código de 6 dígitos** → grava em `whatsapp_link_codes` (TTL 10min).
- Usuário manda o código pro bot → `whatsapp_links` mapeia `phone_number → user_id/org_id`.
- `getLinkedUser(phone)` resolve em toda mensagem. Sem vínculo, o bot pede pra vincular.
- Tabelas: `whatsapp_links` (vínculo ativo, `ai_enabled` por usuário) e `whatsapp_link_codes`
  (códigos pendentes). Override de IA por usuário no `user_metadata.billing.whatsappAiOverride`.

### 1.4 Núcleo de IA — `telegram-ai.tsx` (`callOpenAIWithFunctions`)

- Modelo: **gpt-5.4-mini** (env `OPENAI_MODEL`), fallback gpt-5.4. Helper `buildCompletionBody`
  trata a família gpt-5 (`max_completion_tokens`, sem `temperature` custom).
- **System prompt estático e idêntico** entre chamadas → cai no **prompt cache da OpenAI**
  (90% de desconto do 2º turno em diante). System prompt dinâmico (dados do usuário) separado.
- **Function calling** com `AVAILABLE_FUNCTIONS` (~30 tools: create/list/get de
  producer/farm/plot/planting/activity/event/note/trial, clima, defensivos, web_search…).
  Filtragem por módulo permitido + `WHATSAPP_BLOCKED_TOOLS` (sem edição/exclusão por WhatsApp).
- **Histórico** em KV (`conversationHistory.tsx`), com marcação `list_result` pra não
  contaminar contexto com listas grandes. Auto-reset por regex de inconsistência.
- **Fallbacks determinísticos** (regex) pra chuva e listagens quando a IA não chama a tool —
  resiliência contra não-determinismo do modelo.
- **Logging estruturado** de cada turno (`whatsapp-ai-logging.tsx`): tokens, cache hits,
  tool calls, latência, erros classificados.

### 1.5 Mídia

| Tipo | Pipeline |
|---|---|
| **Áudio** | `downloadWhatsAppMedia` (Graph API) → Whisper (`whisper-1`, `language=pt`) com **prompt de vocabulário agrícola** + nomes reais das fazendas/talhões do usuário pra melhorar reconhecimento → texto vai pro mesmo `callOpenAIWithFunctions`. |
| **Imagem** | Download → **upload R2** → guarda `PendingPhoto` no KV (TTL 10min) → lista interativa: 🔍 Diagnosticar / 💾 Salvar observação / 📌 Outra atividade / 🧪 Anexar a ensaio. Diagnóstico = **Gemini 3.5 Flash Vision** (inline base64) com prompt de agrônomo. |
| **PDF** | Download (limite 2MB) → base64 → **gpt-5 nativo** (`file_data`, sem parser server-side). Exige legenda dizendo o que fazer ("calcula calagem dessa análise"). |

### 1.6 Armazenamento — R2 + Cloudflare Image Transform

- **`r2_storage.tsx`**: `uploadToR2`/`deleteFromR2` via **`aws4fetch`** (SigV4 leve — evita o
  cold-start timeout do `@aws-sdk/client-s3`). Secrets `R2_*`. Chave ex:
  `activities/whatsapp_{userId}/{photoId}.jpg`.
- **`cloudflare_transform.tsx`**: NÃO processa imagem no Deno (imagescript quebra no edge).
  Em vez disso, envolve a URL R2 numa transformação servida pelo CDN da Cloudflare:
  `https://cropware.com.br/cdn-cgi/image/<opts>/<url-r2>`. Variantes: `relatorio`
  (1200×1000 WebP q80), `thumbnail` (200×200), `vision` (2048 JPEG q92). Free tier 5k
  transformações únicas/mês, cacheadas infinitamente.
- **Insight-chave:** todo o aparato R2+CF existe pra **normalizar fotos de campo** (crop,
  WebP, variantes). Para **documento financeiro isso não interessa** — você quer o documento
  fiel e legível, não cropado a 6:5.

### 1.7 Classificação de documentos — `receipt-scanner` (edge function separada)

- `POST /functions/v1/receipt-scanner` recebe `{ image: base64, mimeType }`.
- **Gemini 2.0 Flash** Vision, `responseMimeType: application/json`, `temperature: 0.1`.
- Extrai array de itens: `description, totalValue, date, invoiceNumber, vendor, vendorCnpj,
  category, paymentMethod, notes` + `documentType` + `confidence`.
- **Não persiste** — devolve JSON; o front (`ReceiptScanner.tsx`) mostra em tabela e exporta CSV.
- O Farm já tem a versão evoluída disso (ver §2).

---

## 2. O que o Farm JÁ tem (NÃO reinventar)

O Farm não está em branco. O commit 8 entregou o pipeline de recibos completo:

| Peça | Onde | Estado |
|---|---|---|
| Edge function modular (Hono) | [supabase/functions/farm-api/index.ts](supabase/functions/farm-api/index.ts) | ✅ `verify_jwt=false`, handlers montados |
| **Scan de recibo + OCR** | [handlers/receipts.ts](supabase/functions/farm-api/handlers/receipts.ts) `POST /receipts/scan` | ✅ upload Storage + Gemini → campos estruturados |
| Wrapper Gemini | [lib/gemini.ts](supabase/functions/farm-api/lib/gemini.ts) | ✅ via **proxy `gemini` compartilhado** (model `gemini-3.5-flash`) |
| Prompt OCR | [prompts/receiptOcr.pt-br.ts](supabase/functions/farm-api/prompts/receiptOcr.pt-br.ts) | ✅ JSON estrito, 16 categorias agro, expense/income |
| Tabela `farm_receipts` | [migrations/...init_receipts.sql](supabase/migrations/20260520191341_farm_init_users_meta.sql) | ✅ doc_type, direction, status, vendor, cnpj, category, `attachment_key`, `source` (manual\|photo\|whatsapp\|telegram), `ai_confidence`, `ai_raw` |
| Bucket de anexos | [migrations/...storage_bucket.sql](supabase/migrations/20260520215000_farm_storage_bucket.sql) | ✅ **Supabase Storage** privado `farm-receipts`, 10MB, MIME allowlist, signed URLs |
| Webhook WhatsApp | [handlers/whatsapp.ts](supabase/functions/farm-api/handlers/whatsapp.ts) | ⏳ **stub** — GET verify OK, POST 501, PNID filter já documentado |
| Cron | [handlers/cron.ts](supabase/functions/farm-api/handlers/cron.ts) | ⏳ stub `mark-overdue` (V2) |

**Conclusão:** o caminho mais curto pra "mandar foto do recibo pelo WhatsApp e o app
entender" é **plugar o webhook real no pipeline `scan` que já existe**. ~80% do trabalho de IA
já está pronto.

---

## 3. Divergências CDM × Farm — decisões a tomar

| Tema | CDM | Farm (decisão 2026-05-27) |
|---|---|---|
| **Storage de blobs** | Cloudflare R2 (aws4fetch) + CF Image Transform, bucket **público** | **R2 dedicado `cropware-farm-storage`, PRIVADO + presigned URL.** Não copiar o bucket público do CDM (documento fiscal é sensível). Sem CF Image Transform (não cropa documento). |
| **Acesso ao blob** | URL pública via zona CF | **presigned GET** via `aws4fetch` (TTL ~5min) gerada pela edge |
| **Gemini** | key direta (`GEMINI_API_KEY`), models 2.0/3.5 | **proxy `gemini` compartilhado** com Studio, **model `gemini-3.5-flash`** — tanto OCR quanto o bot conversacional. ⚠️ confirmar se o proxy encaminha `tools` (function calling). |
| **Número WhatsApp** | chips físicos de operadora | **Salvy** (MVNO virtual), número **dedicado** do Farm — ver [salvy study](salvy-whatsapp-migration-study.md) + §5 |
| **WABA** | WABA Cropware (compartilhada Services+Leads) | **WABA própria do Farm** (reaproveita a conta Meta Business existente) |
| **Bot conversacional** | OpenAI function calling (gpt-5.4-mini) | **Gemini 3.5 Flash function calling** — mais atual e barato. Só **Services Bot** no piloto (sem Leads Bot). Persona fazendeiro. |
| **Arquitetura backend** | monólito `index.ts` (14k linhas) | Hono modular por handler (manter) |

### Sobre "padronizar o formato dos registros" (sua observação)

Você está certo: **não cropar documentos**. Mas dá pra padronizar sem R2:

- **Imagens (jpg/png/heic):** comprimir/redimensionar **no cliente** antes do upload —
  canvas pra max ~2000px no lado maior, re-encode JPEG q85 (ou WebP). Já temos
  `deviceCamera.ts`/`deviceFilePicker.ts` herdados do CDM. Isso corta upload e custo de OCR
  sem perder legibilidade.
- **PDF:** manter nativo (não rasterizar). O Gemini lê PDF; o gpt-5 também.
- **Padronização "lógica":** o que realmente padroniza o registro é o **schema
  `farm_receipts` + as 16 categorias do prompt OCR** — isso já está feito. O blob é só anexo
  fiel; a estrutura vem da extração.
- Se um dia o Farm ganhar **fotos de campo** (não-financeiras) e quiser variantes/thumbnails,
  aí sim avaliar R2+CF transform como no CDM.

---

## 4. Plano pra trazer pro Farm (faseado, baixo risco)

### Fase A — Recibo por WhatsApp (a joia, MVP) 🔥

Objetivo: usuário manda **foto/PDF do recibo no WhatsApp** → bot extrai, classifica, salva,
e responde confirmando. Reaproveita 100% o pipeline `scan`.

1. **Implementar `POST /webhook/whatsapp`** em `handlers/whatsapp.ts` (hoje 501):
   - PNID filter (`WHATSAPP_FARM_BOT_PNID`), dedup de `message.id`, background processing,
     safety net por mensagem — **portar os padrões do CDM §1.2**.
2. **`downloadWhatsAppMedia(mediaId)`** via Graph API (idêntico ao CDM; secret
   `WHATSAPP_FARM_BOT_TOKEN`).
3. **Vínculo de conta**: tabelas `farm_whatsapp_links` + `farm_whatsapp_link_codes`, endpoint
   `POST /integrations/generate-code` (hoje 501) + verificação por código de 6 dígitos.
   Copiar o fluxo do CDM (§1.3).
4. **Handler de imagem/PDF** → `extractReceiptFromImage` (já existe) → upload Storage →
   `INSERT farm_receipts` com `source='whatsapp'`, `status='a_pagar'` (ou `a_revisar`) →
   responder: *"✅ Recibo de R$ 287,50 — Fertilizantes — Loja X (17/05). Confirma? [Sim] [Editar]"*.
5. **Confiança baixa** (`confidence < 0.6`) → cria como pendente e pede revisão no app web.

> Entrega: o diferencial do Farm ("foto + WhatsApp + zero planilha") funcionando ponta a ponta.

### Fase B — Bot conversacional financeiro 💬 (Gemini function calling)

Replicar o *padrão* do `callOpenAIWithFunctions`, mas com **Gemini 3.5 Flash function calling**
(não OpenAI) — decisão de custo/atualidade. Mudanças de API vs CDM:

- Function calling em Gemini = `tools: [{ functionDeclarations: [...] }]`; o modelo devolve
  `functionCall` parts, você responde com `functionResponse` parts (loop multi-turn). Difere do
  `tool_calls`/`role:tool` da OpenAI — a camada de orquestração precisa ser reescrita pra esse
  formato.
- **⚠️ Pré-requisito:** confirmar que o proxy `gemini` compartilhado encaminha o campo `tools`
  no `body`. Se não encaminhar, ou (a) ajustar o proxy, ou (b) usar `GEMINI_API_KEY` direta só
  pro bot. Validar antes de construir a Fase B.
- Histórico de conversa em KV (Supabase) por telefone — espelhar `conversationHistory.tsx`.
- Manter os **fallbacks determinísticos** (regex) do CDM pra resiliência (ex: "paguei 1200 de
  diesel" → `create_receipt` mesmo se o modelo não chamar a tool).

Tools financeiras (substituem as agronômicas):

- `create_receipt` (texto: "paguei 1200 de diesel na fazenda X").
- `list_receipts` / `get_financial_summary` (a pagar, a receber, vencido, por categoria/período).
- `mark_paid`, `get_cashflow` (consultas read-only).
- **Persona fazendeiro** (não RTV/GD) — novo `prompts/botSystem.pt-br.ts`.
- Mesmas travas do CDM: **sem edição/exclusão por WhatsApp** (só app web).

### Fase C — Áudio, PDF instrucional, proativo 🔊📄🔔

- **Áudio** (Whisper + vocab) — "registra 500 reais de combustível" falado.
- **PDF com instrução** (boleto/extrato) — pattern do `handleDocumentMessage`.
- **Proativo via pg_cron** — reaproveitar o `cron/mark-overdue`: vence boleto → notifica no
  WhatsApp. Resumo semanal de caixa (sexta 18h). Atenção à janela de 24h da Meta (precisa
  **template aprovado** pra iniciar conversa fora da janela).

---

## 5. Salvy — o que muda concretamente (e o que NÃO muda)

- **NÃO muda o caminho da mensagem.** O bot continua recebendo/enviando por **Meta Cloud
  API**. Salvy só fornece o número e entrega o SMS de verificação por webhook.
- **Registro:** número Salvy → "Add phone number" na WABA (Meta) → recebe SMS de verificação
  via webhook Salvy → número vira "API only" (não fica em celular). Gera-se um novo **PNID**,
  único → o PNID filter do Farm distingue do CDM automaticamente, mesmo dividindo a WABA.
- **Trabalho extra Salvy** (do salvy study): webhook pra capturar o SMS + `SALVY_API_KEY` no
  vault. ~2-4h. Guardar o **PIN 2FA do WhatsApp Business** fora da Salvy (vault próprio).
- **Multi-tenant futuro:** Salvy + API permite, no futuro, cada organização cliente ter o
  próprio número provisionado via dashboard — diferencial do Farm. Vale desenhar a UI de
  integração já pensando nisso.

---

## 6. Pontos de atenção / riscos

- **Deploy sempre `--no-verify-jwt`** (webhook é público) — já é o padrão do farm-api.
- **Janela de 24h da Meta**: proatividade (Fase C) exige template aprovado. Mensagens
  reativas (usuário falou primeiro) são livres por 24h.
- **Custo OCR**: cada foto = 1 chamada Gemini. Comprimir no cliente reduz tokens. Gemini
  3.5 Flash é barato, mas monitorar volume.
- **Blast radius do proxy `gemini` compartilhado** com Studio — se o proxy cair ou mudar
  contrato, o scan do Farm cai junto. Considerar alertazinho/healthcheck.
- **Dedup + background processing são obrigatórios** desde o dia 1 — sem eles, foto vira
  recibo duplicado (Meta retenta).
- **LGPD/segurança**: documento fiscal tem CNPJ, valores. Manter bucket privado + signed URL
  curto. Nunca log de base64.

---

## 7. Decisões (RESOLVIDAS — 2026-05-27)

1. **Storage:** ✅ **Cloudflare R2 dedicado** (`cropware-farm-storage`), **privado + presigned
   URL** (não público como o CDM, por ser documento fiscal). Migrar o `/receipts/scan` do
   Supabase Storage pro R2.
2. **Número Farm:** ✅ **Salvy dedicado** (novo número exclusivo do Farm). Ver passos no §8.
3. **WABA:** ✅ **WABA própria do Farm** (na conta Meta Business existente). PNID será único de
   qualquer forma; WABA separada dá isolamento de limites/templates/billing.
4. **Recibo via WhatsApp:** ✅ **Cria direto, após confirmação dos dados pelo próprio WhatsApp.**
   Fluxo: scan → bot mostra os campos extraídos → usuário confirma (botão Sim) → `INSERT
   farm_receipts` com `source='whatsapp'`. Se quiser corrigir, botão Editar abre no app web.
   (Sem fila `a_revisar` separada — a revisão é a confirmação no chat.)
5. **Bot conversacional (Fase B):** ✅ **Sim, implementar** — com Gemini 3.5 Flash (ver Fase B).
   Só **Services Bot**; sem Leads Bot no piloto.

---

## 8. Setup externo (o que VOCÊ faz no painel) — pré-requisitos da Fase A

### 8.1 R2 — bucket dedicado privado
1. Cloudflare → **R2** → **Create bucket** → nome `cropware-farm-storage`, location hint
   **South America**. **NÃO** conectar custom domain (mantém privado — diferente do
   `cropware-storage` do CDM, que é público).
2. **Manage R2 API Tokens** → **Create API token**: nome `cropware-farm-edge`, permissão
   **Object Read & Write**, escopo só no bucket `cropware-farm-storage`.
3. Copiar **Access Key ID**, **Secret Access Key** e o **Account ID** (do endpoint
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).
4. Setar secrets na edge `farm-api` (projeto Supabase do Farm — `tzsmxhwvtobwkqffgsxo`):
   ```
   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
   R2_BUCKET_NAME=cropware-farm-storage
   ```
   (Sem `R2_PUBLIC_URL` — acesso é por presigned URL, não domínio público.)

### 8.2 Meta — WABA própria do Farm
1. [business.facebook.com](https://business.facebook.com) (mesma conta Meta Business) →
   **WhatsApp Accounts** → criar **nova WABA** "Cropware Farm".
2. Meta Developers → criar app Business "Cropware Farm Bot" → adicionar produto **WhatsApp**.
3. **System User Token** (never-expire) com `whatsapp_business_messaging` +
   `whatsapp_business_management`, acesso à WABA nova.

### 8.3 Salvy — número dedicado
1. Criar conta Salvy → ativar **1 número novo** (R$ 29,90/mês, sem fidelidade) só pro Farm.
2. Em **WhatsApp → API Setup** da WABA do Farm: **Add phone number** → número Salvy.
3. Receber o **SMS de verificação via webhook Salvy** (configurar `SALVY_API_KEY` + endpoint que
   captura o código) → confirmar na Meta. O número vira "API only".
4. Anotar o **Phone Number ID (PNID)** do número → secret `WHATSAPP_FARM_BOT_PNID`.
5. ⚠️ Guardar o **PIN 2FA do WhatsApp Business** num vault próprio (não só na Salvy).
6. Configurar webhook na Meta → Callback URL:
   `https://tzsmxhwvtobwkqffgsxo.supabase.co/functions/v1/farm-api/webhook/whatsapp`,
   Verify Token = `WHATSAPP_VERIFY_TOKEN`, subscribe `messages` + `message_status`.

Secrets WhatsApp da edge: `WHATSAPP_FARM_BOT_TOKEN` (system user token), `WHATSAPP_FARM_BOT_PNID`,
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_FARM_BOT_WABA_ID`, `SALVY_API_KEY`.

### 8.4 Divisão de trabalho

| Você (painel) | Eu (código) |
|---|---|
| 8.1 bucket+token R2 | `lib/r2.ts` + migrar `/receipts/scan` pro R2 + presigned read |
| 8.2 WABA + token Meta | webhook real (`POST /webhook/whatsapp`) + dispatch + safety nets |
| 8.3 número Salvy + webhook SMS | tabelas de vínculo + `generate-code` + verificação 6 dígitos |
| setar secrets | handler de imagem/PDF → OCR → confirma → cria `farm_receipts` |
| (Fase B) — | bot Gemini function calling + tools financeiras + histórico KV |

---

## Referências (CDM — `C:\Cropware\cropware`)

- `supabase/functions/make-server-875c00b5/index.ts` — webhook services bot, mídia, linking
- `supabase/functions/make-server-875c00b5/telegram-ai.tsx` — núcleo function calling
- `supabase/functions/make-server-875c00b5/r2_storage.tsx` + `cloudflare_transform.tsx` — storage
- `supabase/functions/receipt-scanner/index.ts` — OCR de recibo (Gemini 2.0 Flash)
- `supabase/functions/make-server-875c00b5/whatsapp-leads-bot.tsx` — state machine de leads
- `docs/whatsapp-evolution-plan.md` — 10 fases do bot de serviços
- `docs/whatsapp-leads-bot-setup.md` — setup Meta/WABA, custos, tracking de origem

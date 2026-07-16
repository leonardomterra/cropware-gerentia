# Pendências abertas — Etapa 2 (Pendências) + Notificações

**Sessões:** 14–15/07/2026. Atualizado após os **meios de pagamento + fluxo de receita** (tudo em produção e testado no WhatsApp real).

---

## 1. ✅ Corrigido e em produção (16/07) — dedup do webhook agora é persistente

**Era o maior débito aberto.** `seenMessageIds` era um `Map` em memória ([handlers/whatsapp.ts](../supabase/functions/gerentia-api/handlers/whatsapp.ts)) — memória de isolate **não sobrevive a cold start nem é compartilhada entre isolates**. Deploy mata isolate, então mensagem reentregue pela Meta passava batido pelo dedup.

Apareceu de verdade em 15/07: um tap em "Confirmar" foi processado 2x e o bot mandou *"Esse cadastro expirou. Manda de novo."* logo depois do "Lançado:" — falso e perigoso (obedecer duplicaria o lançamento).

**O fix (16/07):** nova tabela `farm_wa_seen_messages(message_id text primary key, created_at)` — migration [`20260716120000_gerentia_wa_seen_messages.sql`](../supabase/migrations/20260716120000_gerentia_wa_seen_messages.sql), RLS ligada sem policies (só service_role), espelhando `farm_wa_pending`. `alreadyHandled()` virou `async`: faz `insert` do `message_id` e trata conflito de unique (`23505`) como duplicata → ignora. **Atômico e vale entre isolates.** O `Map` ficou só como fast-path (retry no mesmo isolate quente evita ida ao banco); não é mais a autoridade. Em erro transitório do banco → **fail-open** (processa): o caminho do dinheiro já é idempotente via `claimPending`, então o pior caso é repetir um passo não-terminal, nunca duplicar lançamento.

**Limpeza (TTL):** o cron `/cron/process-alerts` (06:00 BRT, **sem schedule novo**) apaga as linhas com mais de 24h — depois disso nenhum retry da Meta chega mais.

**O que já estava protegido:** o caminho que grava dinheiro — `claimPending()` (`DELETE ... RETURNING`) faz o Postgres arbitrar quem finaliza o wizard. Agora os **passos não terminais** (`cw_cat:ok`, `cw_status:`, `cw_cc:`, `cw_wpay:`, `cw_venc:`) também estão cobertos: o retry nem chega a chamar `advanceWizard` 2x.

**Deploy feito (16/07):** `npx supabase db push` aplicou a migration `20260716120000` (confirmado no `supabase migration list` — remote = local) e `npm run deploy:edge` subiu a `gerentia-api`. Produção já usa o dedup persistente.

## 2. 🧪 Testes que nunca foram feitos (agora possíveis)

Features escritas e deployadas, mas **nunca exercitadas**. Com o front no ar, dá pra testar:

- [ ] **Fluxo de conversão** lembrete → lançamento (Converter → form pré-preenchido **com valor e centro** → salvar → lembrete vira resolvido + o lançamento aparece na coluna). É a parte mais nova que **escreve dados**.
- [ ] **Lembrete valorado pelo WhatsApp**: "anota: pagar 500 pro fornecedor sexta" → deve nascer com `total_value` e `due_date`. Confere também a fronteira nova: "paguei o contador" tem que virar **lançamento**, não lembrete.
- [ ] **Cron de notificações** (`/cron/process-alerts`) — precisa do `x-cron-secret` (está no Vault) ou esperar o run automático das **06:00 BRT**. Verificar:
  - Rodar 1x → linhas em `farm_notifications`; **rodar 2x → não duplica** (idempotência do unique).
  - **Usuário SEM WhatsApp vinculado recebe notificação** ← é o bug que motivou a reestruturação dos canais.
  - **O envio WhatsApp continua idêntico** (não regrediu).
  - Tarefas com vencimento geram notificação.

## 3. 🎨 Decisões reversíveis (tela Pendências)

Os 4 impasses da lista anterior **foram resolvidos pela decisão de escopo de 15/07** (Pendências = to-do só financeiro; "tarefa" → **Lembrete**): o "Concluir" avulso saiu, o menu "Converter" ficou, e os placeholders viraram campo de verdade (valor + centro, opcionais, no dialog). Altura `min-h-[12rem]` mantida.

- [ ] **(Opcional)** A descrição perdeu o "espiar rápido" quando as ações viraram dropdown. Segue em **Ver detalhes**; dá pra pôr um indicador discreto na coluna Origem.
- [ ] **(Fronteira a observar)** O que fazer com lembrete resolvido que **não** virou lançamento — hoje só o Reativar/Tirar. Se aparecer na prática, é sinal de que sobrou to-do não-financeiro na tela.

## 4. 🅿️ Parado conscientemente → [FUTURAS-FEATURES.md](FUTURAS-FEATURES.md)

- **Lembretes proativos por WhatsApp** (Etapa 2b) — Meta reclassifica UTILITY→MARKETING: custo ~7-9x e, pior, risco de não entregar por opt-out. O template `farm_lembrete_tarefa` ficou **PENDING**; nenhum cron o usa e não custa nada ficar lá.
- **`farm_alerta_vencimento` está APPROVED como MARKETING** e roda diariamente em produção, sujeito a opt-out. Decisão 15/07: **deixar como está**.
- **Push nativo / Web Push** — o substituto certo (grátis por mensagem, sem Meta). O app não tem plugin de notificação nem service worker/PWA hoje: seria do zero. A tabela `farm_notifications` já é a fonte única, então adicionar esse canal não mexe no produtor.

---

## ✅ Já feito — tudo em produção (15/07)

**Meios de pagamento + fluxo de receita (15/07) — testado no WhatsApp real:**
- **O bug**: `sendButtons` corta em 3 (limite da Meta) e `WIZ_PAY_BUTTONS` tinha 6 — o usuário via só Crédito/Débito/Pix. Dinheiro, Boleto e "Pular" **nunca eram renderizados**, e como o step não aceita texto, quem pagou em dinheiro ficava **sem saída** (mentir ou cancelar). Virou `sendList` (10 linhas), o mesmo recurso que o seletor de Centros já usava.
- **`debito_automatico`** entrou (enum, select do app, prompts, `PAY_LABEL`). Sem migration: `payment_method` é `text` livre, sem CHECK. Entra também no `proofByMethod` — debitado em conta = dinheiro já saiu = nasce `pago`.
- **Depósito não virou valor próprio**: contabilmente é o mesmo dinheiro caindo na conta. Virou rótulo ("Transferência / Depósito" no app) e subtítulo na lista — o título da lista corta em 24 chars e o rótulo tem 26.
- **Receita**: o step `payment` era pulado de propósito, mas a IA preenchia `payment_method` do texto e o resumo dizia "Pagamento:" pra dinheiro entrando. Agora pergunta **"Como foi recebido?"** com lista própria (sem crédito/débito) e o resumo diz **"Recebimento:"**. Vale pra foto também: sem o meio, o `isProof` não dispara e o comprovante nascia `a_receber`.
- **"Sem vencimento"**: a mensagem de erro do parser já prometia o botão, mas ele não existia — não havia saída do step sem digitar data válida. Agora existe (3 botões = teto da Meta), e a pergunta é "Quando vence?"/"Quando você recebe?".
- **Title Case na origem**: "Origem: joão" → "João". Partículas minúsculas ("João da Silva").

**Escopo financeiro (15/07) — o to-do geral foi adiado pra um app próprio:**
- `farm_tasks` ganhou `total_value` + `cost_center_id` (ambos opcionais — o lembrete nasce de um "anota: X" sem valor).
- Card: **sai o "Concluir" avulso** (se todo lembrete é financeiro, resolver = converter em lançamento); valor e centro mostram dado real. Dialog ganhou os dois campos. A conversão leva ambos pro form.
- Agente: o prompt e a tool `create_task` diziam **o oposto** ("NÃO é financeiro"). A distinção agora é o **tempo, não o assunto** — "paguei o contador" é lançamento, "me lembra de pagar o contador" é lembrete. A tool aceita `total_value`.
- Copy "tarefa" → **"Lembrete"** nos dois lados. O template Meta `farm_lembrete_tarefa` mantém o nome (está registrado lá).

**Backend:**
- **Etapa 1 — Reconciliação**: comprovante do WhatsApp casa com conta em aberto (inclui recorrentes) em vez de duplicar; comprovante de pagamento nasce `pago`.
- **Etapa 2 — Pendências**: `farm_tasks`, rotas `/tasks`, tools WhatsApp (create/list/complete_task).
- **Notificações**: `farm_notifications`, rotas (`GET /notifications` com unread junto, mark-read, read-all, delete) e o **cron reestruturado** — canais WhatsApp e in-app independentes + varredura de tarefas.
- **Fixes**: `relativeDay` → "amanhã" (typo que ia na mensagem real do alerta diário), uppercase do título de tarefa no `execCreateTask`.
- **Histórico de migrations sincronizado** (3 estavam aplicadas mas não registradas).

**Frontend (Cloudflare Pages, deploy no push pra `main`):**
- Tela **Pendências**: 3 colunas (Lembretes / Pagar / Receber), conversão lembrete → lançamento, busca estilo Lançamentos.
- Página **Notificações** + badge no menu (dot na sidebar colapsada e na bottom bar) + **toasts** de notificação nova.
- **Polimento das 4 tabelas** (Lançamentos/Anexos/Faturas/Notas): ações viram dropdown, datas abreviadas, "Valor R$", tooltips nos textos truncados. Colunas de **1210px → 974px**. A causa do estouro era a coluna de ações pedir 212px num `w-[160px]` de uma `table-fixed`.
- **Tooltips estilizados** no `ActionIconButton` (antes só o `title` nativo, que não aparecia).
- **PaywallGate: master não é mais bloqueado** pelo trial da própria org (antes o dono ficava trancado fora do próprio app, inclusive do /admin).
- Uppercase em recorrências e tarefas; **Title Case** nos títulos de diálogo; **"Link Inválido"** (typo de acento) e "Senha Atualizada"; separador **"·" → "-"**.

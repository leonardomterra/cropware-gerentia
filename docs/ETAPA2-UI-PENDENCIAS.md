# Pendências abertas — Etapa 2 (Pendências) + Notificações

**Sessões:** 14–15/07/2026. Atualizado após o **escopo financeiro** (migration + edge + front todos em produção).

---

## 1. 🧪 Testes que nunca foram feitos (agora possíveis)

Features escritas e deployadas, mas **nunca exercitadas**. Com o front no ar, dá pra testar:

- [ ] **Fluxo de conversão** lembrete → lançamento (Converter → form pré-preenchido **com valor e centro** → salvar → lembrete vira resolvido + o lançamento aparece na coluna). É a parte mais nova que **escreve dados**.
- [ ] **Lembrete valorado pelo WhatsApp**: "anota: pagar 500 pro fornecedor sexta" → deve nascer com `total_value` e `due_date`. Confere também a fronteira nova: "paguei o contador" tem que virar **lançamento**, não lembrete.
- [ ] **Cron de notificações** (`/cron/process-alerts`) — precisa do `x-cron-secret` (está no Vault) ou esperar o run automático das **06:00 BRT**. Verificar:
  - Rodar 1x → linhas em `farm_notifications`; **rodar 2x → não duplica** (idempotência do unique).
  - **Usuário SEM WhatsApp vinculado recebe notificação** ← é o bug que motivou a reestruturação dos canais.
  - **O envio WhatsApp continua idêntico** (não regrediu).
  - Tarefas com vencimento geram notificação.

## 2. 🎨 Decisões reversíveis (tela Pendências)

Os 4 impasses da lista anterior **foram resolvidos pela decisão de escopo de 15/07** (Pendências = to-do só financeiro; "tarefa" → **Lembrete**): o "Concluir" avulso saiu, o menu "Converter" ficou, e os placeholders viraram campo de verdade (valor + centro, opcionais, no dialog). Altura `min-h-[12rem]` mantida.

- [ ] **(Opcional)** A descrição perdeu o "espiar rápido" quando as ações viraram dropdown. Segue em **Ver detalhes**; dá pra pôr um indicador discreto na coluna Origem.
- [ ] **(Fronteira a observar)** O que fazer com lembrete resolvido que **não** virou lançamento — hoje só o Reativar/Tirar. Se aparecer na prática, é sinal de que sobrou to-do não-financeiro na tela.

## 3. 🅿️ Parado conscientemente → [FUTURAS-FEATURES.md](FUTURAS-FEATURES.md)

- **Lembretes proativos por WhatsApp** (Etapa 2b) — Meta reclassifica UTILITY→MARKETING: custo ~7-9x e, pior, risco de não entregar por opt-out. O template `farm_lembrete_tarefa` ficou **PENDING**; nenhum cron o usa e não custa nada ficar lá.
- **`farm_alerta_vencimento` está APPROVED como MARKETING** e roda diariamente em produção, sujeito a opt-out. Decisão 15/07: **deixar como está**.
- **Push nativo / Web Push** — o substituto certo (grátis por mensagem, sem Meta). O app não tem plugin de notificação nem service worker/PWA hoje: seria do zero. A tabela `farm_notifications` já é a fonte única, então adicionar esse canal não mexe no produtor.

---

## ✅ Já feito — tudo em produção (15/07)

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

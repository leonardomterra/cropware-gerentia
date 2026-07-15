# Pendências abertas — Etapa 2 (Pendências) + Notificações

**Sessões:** 14–15/07/2026. Atualizado após o deploy do módulo de Notificações.

**Resumo do estado:** o **backend está todo em produção**. O **frontend inteiro está só no dev local** — esse é o maior item aberto.

---

## 1. 🔴 Deploy do frontend (o mais importante)

Nada abaixo está no ar pra você ou pros usuários. Tudo depende do pipeline web / próximo build iOS:

- Tela **Pendências** (To-Do + financeiro a resolver) e todos os polimentos.
- **Polimento das 4 tabelas** (Lançamentos, Anexos, Faturas, Notas e Recibos).
- Página **Notificações** + badge no menu + toasts.
- **Bypass do paywall pro master** — sem ele, você (master) continua **trancado fora do `gerentia.app`** quando o trial da org vence.
- Title Case nos títulos de diálogo.

## 2. 🧪 Testes que nunca foram feitos

Duas features escritas e deployadas, mas **nunca exercitadas** (eu não faço login e não tenho o secret do cron):

- [ ] **Cron de notificações** (`/cron/process-alerts`) — precisa do `x-cron-secret` (está no Vault). Verificar:
  - Rodar 1x → linhas em `farm_notifications`; **rodar 2x → não duplica** (idempotência do unique).
  - **Usuário SEM WhatsApp vinculado recebe notificação** ← é o bug que motivou a reestruturação dos canais.
  - **O envio WhatsApp continua idêntico** (não regrediu).
  - Tarefas com vencimento geram notificação.
  - *Alternativa: esperar o run automático das 06:00 BRT e conferir a tabela.*
- [ ] **Fluxo de conversão** tarefa → lançamento (Converter → form pré-preenchido → salvar → tarefa vira concluída + aparece na coluna). É a parte mais nova que escreve dados.

## 3. Decisões reversíveis (cosmético, tela Pendências)

- [ ] Manter o botão **"Concluir"** simples além dos 3 conversores? (hoje: mantido, pra tarefa não-financeira)
- [ ] Conversões num **menu "Converter"** vs. 3 botões visíveis? (hoje: menu)
- [ ] **Placeholders** "R$ 0,00" e "Sem centro" no card de tarefa (só pra igualar o layout ao financeiro).
- [ ] **Altura dos cards**: `min-h-[12rem]` fixo. Ajustar se algum destoar.

## 4. Achados extras (pequenos)

- [ ] **Telas de auth**: `ResetPasswordScreen` — "Link invalido" → **"Link Inválido"** (Title Case + **acento faltando, é typo real**) e "Senha atualizada" → **"Senha Atualizada"**.
- [ ] **Outros "·" no app**: Recorrências (" · termina"), Relatórios (`.join(" · ")`), badge "Tipo · N itens", card de Assinatura. Trocar por "-" ou remover.
- [ ] **(Opcional)** Tooltip no chip de **Centro de Custo** na tabela (é um ícone sem tooltip, como era o de tipo de doc).
- [ ] **(Opcional)** A descrição perdeu o "espiar rápido" quando as ações viraram dropdown. Segue em **Ver detalhes**; dá pra pôr um indicador discreto na coluna Origem.

## 5. 🅿️ Parado conscientemente → [FUTURAS-FEATURES.md](FUTURAS-FEATURES.md)

- **Lembretes proativos por WhatsApp** (Etapa 2b) — Meta reclassifica UTILITY→MARKETING: custo ~7-9x e, pior, risco de não entregar por opt-out. O template `farm_lembrete_tarefa` ficou **PENDING** na Meta; não é usado por nenhum cron e não custa nada ficar lá.
- **`farm_alerta_vencimento` está APPROVED como MARKETING** e roda diariamente em produção, sujeito a opt-out. Decisão 15/07: **deixar como está** por enquanto.
- **Push nativo / Web Push** — o substituto certo (grátis por mensagem, sem Meta), mas o app não tem nenhum plugin de notificação nem service worker/PWA hoje. Seria do zero.

---

## ✅ Já feito

**Em produção (backend):**
- **Etapa 1 — Reconciliação**: comprovante do WhatsApp casa com conta pendente (inclui recorrentes) em vez de duplicar; comprovante de pagamento nasce `pago`.
- **Etapa 2 — backend**: `farm_tasks`, rotas `/tasks`, tools WhatsApp (create/list/complete_task).
- **Notificações**: tabela `farm_notifications`, rotas (`GET /notifications` com unread junto, mark-read, read-all, delete) e o **cron reestruturado** — canais WhatsApp e in-app agora independentes + varredura de tarefas.
- **Fixes**: `relativeDay` → "amanhã" (typo que ia na mensagem real do alerta diário), uppercase do título de tarefa no `execCreateTask`, exemplo do template.
- **Histórico de migrations sincronizado** (3 migrations estavam aplicadas mas não registradas).

**Só no dev local (frontend):** ver seção 1.

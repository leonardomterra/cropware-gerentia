# Pendências abertas — Etapa 2 (Pendências) + Notificações

**Sessões:** 14–15/07/2026. Atualizado após o deploy do frontend (front + backend agora **ambos em produção**).

---

## 1. 🧪 Testes que nunca foram feitos (agora possíveis)

Features escritas e deployadas, mas **nunca exercitadas**. Com o front no ar, dá pra testar:

- [ ] **Fluxo de conversão** tarefa → lançamento (Converter → form pré-preenchido → salvar → tarefa vira concluída + o lançamento aparece na coluna). É a parte mais nova que **escreve dados**.
- [ ] **Cron de notificações** (`/cron/process-alerts`) — precisa do `x-cron-secret` (está no Vault) ou esperar o run automático das **06:00 BRT**. Verificar:
  - Rodar 1x → linhas em `farm_notifications`; **rodar 2x → não duplica** (idempotência do unique).
  - **Usuário SEM WhatsApp vinculado recebe notificação** ← é o bug que motivou a reestruturação dos canais.
  - **O envio WhatsApp continua idêntico** (não regrediu).
  - Tarefas com vencimento geram notificação.

## 2. 🎨 Decisões reversíveis (tela Pendências)

- [ ] Manter o botão **"Concluir"** simples além dos 3 conversores? (hoje: mantido, pra tarefa não-financeira)
- [ ] Conversões num **menu "Converter"** vs. 3 botões visíveis? (hoje: menu)
- [ ] **Placeholders** "R$ 0,00" e "Sem centro" no card de tarefa (existem só pra igualar o layout ao financeiro).
- [ ] **Altura dos cards**: `min-h-[12rem]` fixo. Ajustar se algum destoar.
- [ ] **(Opcional)** A descrição perdeu o "espiar rápido" quando as ações viraram dropdown. Segue em **Ver detalhes**; dá pra pôr um indicador discreto na coluna Origem.

## 3. 🅿️ Parado conscientemente → [FUTURAS-FEATURES.md](FUTURAS-FEATURES.md)

- **Lembretes proativos por WhatsApp** (Etapa 2b) — Meta reclassifica UTILITY→MARKETING: custo ~7-9x e, pior, risco de não entregar por opt-out. O template `farm_lembrete_tarefa` ficou **PENDING**; nenhum cron o usa e não custa nada ficar lá.
- **`farm_alerta_vencimento` está APPROVED como MARKETING** e roda diariamente em produção, sujeito a opt-out. Decisão 15/07: **deixar como está**.
- **Push nativo / Web Push** — o substituto certo (grátis por mensagem, sem Meta). O app não tem plugin de notificação nem service worker/PWA hoje: seria do zero. A tabela `farm_notifications` já é a fonte única, então adicionar esse canal não mexe no produtor.

---

## ✅ Já feito — tudo em produção (15/07)

**Backend:**
- **Etapa 1 — Reconciliação**: comprovante do WhatsApp casa com conta em aberto (inclui recorrentes) em vez de duplicar; comprovante de pagamento nasce `pago`.
- **Etapa 2 — Pendências**: `farm_tasks`, rotas `/tasks`, tools WhatsApp (create/list/complete_task).
- **Notificações**: `farm_notifications`, rotas (`GET /notifications` com unread junto, mark-read, read-all, delete) e o **cron reestruturado** — canais WhatsApp e in-app independentes + varredura de tarefas.
- **Fixes**: `relativeDay` → "amanhã" (typo que ia na mensagem real do alerta diário), uppercase do título de tarefa no `execCreateTask`.
- **Histórico de migrations sincronizado** (3 estavam aplicadas mas não registradas).

**Frontend (Cloudflare Pages, deploy no push pra `main`):**
- Tela **Pendências**: 3 colunas (Tarefas / A pagar / A receber), conversão tarefa → lançamento, busca estilo Lançamentos.
- Página **Notificações** + badge no menu (dot na sidebar colapsada e na bottom bar) + **toasts** de notificação nova.
- **Polimento das 4 tabelas** (Lançamentos/Anexos/Faturas/Notas): ações viram dropdown, datas abreviadas, "Valor R$", tooltips nos textos truncados. Colunas de **1210px → 974px**. A causa do estouro era a coluna de ações pedir 212px num `w-[160px]` de uma `table-fixed`.
- **Tooltips estilizados** no `ActionIconButton` (antes só o `title` nativo, que não aparecia).
- **PaywallGate: master não é mais bloqueado** pelo trial da própria org (antes o dono ficava trancado fora do próprio app, inclusive do /admin).
- Uppercase em recorrências e tarefas; **Title Case** nos títulos de diálogo; **"Link Inválido"** (typo de acento) e "Senha Atualizada"; separador **"·" → "-"**.

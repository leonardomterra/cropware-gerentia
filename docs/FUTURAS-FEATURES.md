# Futuras features — ideias adiadas conscientemente

**Propósito:** estacionamento de ideias que **decidimos não fazer agora**, com o **motivo** registrado. Não é backlog de execução (isso é o [FARM-ROADMAP.md](FARM-ROADMAP.md)) — é memória de decisão, pra quando retomarmos não refazermos a mesma análise nem repetirmos o mesmo erro.

---

## 1. 🅿️ Lembretes proativos por WhatsApp (push ativo)

**Adiado em:** 15/07/2026
**Era:** Etapa 2b — cron `farm-task-reminders` mandando o bot cobrar a tarefa/conta quando vence.

### Por que paramos

A Meta **reclassifica esses templates de UTILITY para MARKETING**. A regra: *utility* não pode promover nem **incentivar novo engajamento** — qualquer cue promocional ou CTA derruba a categoria, mesmo com conteúdo transacional. Nossos templates tinham **os dois** gatilhos:

```
🔔 gerentia.app          ← header de marca  = brand awareness
Conta com {{1}} (R$ {{2}}) vence {{3}}.
Detalhes no app.         ← CTA             = engagement cue
```

**Consequências (a segunda é a que mata):**

| | Utility | Marketing |
|---|---|---|
| Custo/msg (BR) | ~R$ 0,04–0,05 | ~R$ 0,30–0,35 (**≈7–9x**) |
| Opt-out do usuário | não se aplica | **sim** — pode **não ser entregue** |

O custo é o menor problema (mesmo a R$0,34, ~10 msgs/mês = R$3,40 vs. ticket de R$89). **O problema é entregabilidade:** marketing está sujeito a opt-out e limites por usuário — então o "sua conta vence amanhã" **pode simplesmente não chegar**, matando a função do recurso. Um lembrete que não é confiável é pior que nenhum.

**Agravante:** o classificador **não é determinístico**. O `farm_resumo_semanal` passou como UTILITY com **o mesmo padrão** que fez o `farm_alerta_vencimento` virar MARKETING. Ou seja, não dá pra garantir a categoria — o que torna o recurso instável por natureza.

**Contexto:** esse padrão **já mordeu em outros apps** (relato do Leonardo, 15/07). É um problema recorrente da plataforma, não um bug nosso.

### Estado atual (pra quem retomar)

- `farm_alerta_vencimento` — **APPROVED como MARKETING**, rodando **diariamente em produção** (cron `farm-process-alerts`). ⚠️ Sujeito a opt-out hoje. **Decisão 15/07: deixar como está por enquanto** (adiado junto com o resto). Quando voltar: reescrever utility-compliant num nome novo (`_v2`) e apontar o cron — ou aposentar em favor de push nativo (ver item 2 abaixo).
- `farm_resumo_semanal` — APPROVED **UTILITY** (sexta, cron `farm-weekly-summary`).
- `farm_lembrete_tarefa` — submetido 15/07, ficou **PENDING**. **Não é usado por nenhum cron** (a Etapa 2b nunca foi construída). Template aprovado e não usado **não custa nada** — pode ficar lá.
- Coluna `farm_tasks.reminded_at` **já existe** (era o dedup do cron 2b) — sem uso por ora.
- A rota `/admin/submit-templates` (`handlers/cron.ts`) **já tem o `farm_lembrete_tarefa` pronto** pra submeter.

### Como amadurecer (quando voltar)

1. **Texto utility-compliant:** sem header de marca, sem CTA. Ex.: `Conta com {{1}} no valor de R$ {{2}} vence {{3}}.` — o WhatsApp **já mostra o nome do negócio no cabeçalho da conversa**, então "gerentia.app" no corpo é redundante. Isso aumenta a chance de UTILITY, mas **não garante** (ver "não determinístico").
2. **Avaliar alternativas ao push pago**, provavelmente melhores:
   - **Dentro da janela de 24h** o utility é **grátis** — vale desenhar o produto pra o lembrete "pegar carona" numa conversa que o usuário já iniciou.
   - **Push nativo** (Capacitor) — sem custo por mensagem, sem Meta no meio.
   - **Notificação in-app** / e-mail.
3. **Entender o mercado/comportamento primeiro** — validar que o usuário quer ser cobrado proativamente antes de investir em infra de mensageria paga.

**Decisão:** adiado até entender melhor o mercado e a forma de implantação.

---

## 2. Outras ideias mapeadas (sessão de estratégia, 14/07)

Levantadas na discussão de como justificar o Pro a R$89 — ver [ETAPA2-UI-PENDENCIAS.md](ETAPA2-UI-PENDENCIAS.md) e a memória do projeto:

- **Consultor proativo** — resumo/insight gerado por IA (anomalias, tendências, fechamento de mês) em vez de template fixo. *Nota: esbarra no mesmo problema de push acima — o insight rico precisa da janela de 24h.*
- **Onboarding conversacional no WhatsApp** — o "aha do dia 1" acontece no próprio bot. Ataca a **ativação**, que é o gargalo real do trial sem cartão.
- **Captura de comprovante Pix / print de banco** — reconhecer o padrão especificamente.
- **Cobrança de recebíveis** — o bot prepara a mensagem + link Pix pro cliente devedor.
- **Conciliação leve (import OFX)** — fecha o loop "bateu com o banco" sem o Pluggy (R$2,5k/mês fixo).
- **Camada fiscal (~R$169/mês)** — upsell futuro; só com demanda validada (ver [FARM-FISCAL-VIABILITY.md](FARM-FISCAL-VIABILITY.md)).

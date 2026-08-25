# Futuras features — ideias adiadas conscientemente

**Propósito:** estacionamento de ideias que **decidimos não fazer agora**, com o **motivo** registrado. Não é backlog de execução (isso é o [FARM-ROADMAP.md](FARM-ROADMAP.md)) — é memória de decisão, pra quando retomarmos não refazermos a mesma análise nem repetirmos o mesmo erro.

---

## 1. 🅿️ Lembretes proativos por WhatsApp (push ativo)

> ## ⛔ DECIDIDO EM 24/08/2026 — WhatsApp é canal de ENTRADA
>
> O envio proativo foi **desligado no código** (`ENVIO_PROATIVO_WHATSAPP = false`
> em `handlers/cron.ts`), e a decisão substitui o "deixar como está" de 15/07.
>
> **O raciocínio, em uma linha:** o valor do WhatsApp aqui é o cliente MANDAR —
> foto do recibo virando lançamento. Isso é iniciado por ele, cai na janela de
> 24h, não passa por aprovação de template e não é cobrado. É o diferencial do
> produto. Mandar mensagem proativa é o oposto em tudo: template aprovado,
> cobrança por mensagem, aperto a cada revisão da Meta, e a categoria MARKETING
> ainda sujeita a opt-out. É a parte COMUM do produto — todo app avisa
> vencimento — pela parte cara e frágil da infraestrutura.
>
> **O alerta de vencimento não se perdeu.** O mesmo laço do cron já criava a
> notificação dentro do app ANTES de tentar o WhatsApp, e ela continua. O que
> falta é avisar quem não abriu o app — e isso é **push nativo**, que ainda não
> existe. Virou a prioridade de notificação.
>
> **O resumo semanal deixou de existir**, porque o WhatsApp era o único canal
> dele. Não se perdeu nada: veja a correção logo abaixo.
>
> ### ⚠️ Correção: ele nunca esteve rodando
>
> Esta seção dizia que `farm_alerta_vencimento` estava "rodando diariamente em
> produção". **Não estava.** Em 24/08/2026, ao testar o cron de backup,
> descobrimos que os dois jobs de HTTP nunca funcionaram:
>
> | job                   | falhas | desde      | sucessos |
> | --------------------- | ------ | ---------- | -------- |
> | `farm-process-alerts` | 83     | 03/06/2026 | **zero** |
> | `farm-weekly-summary` | 12     | 05/06/2026 | **zero** |
>
> Causa: `extensions.net.http_post` em vez de `net.http_post` — o `pg_net`
> instala em `net`, e o prefixo faz o Postgres ler aquilo como referência a
> outro banco. O erro só existia em `cron.job_run_details`, onde ninguém olha.
> `farm_alert_log` tem **0 linhas**, coerente com nunca ter tentado.
>
> Corrigido em `20260824140000_fix_cron_net_schema.sql` — mas a conclusão para
> este documento é outra: **a decisão de 15/07 de "deixar como está" foi tomada
> sobre uma premissa falsa.** Ninguém nunca recebeu um alerta, e portanto nunca
> houve sinal de mercado sobre esse recurso.
>
> **Para religar:** trocar a constante para `true`. O código de envio segue
> inteiro; o template segue aprovado. Antes, medir o custo por mensagem no
> painel da Meta — as tarifas mudam — e reescrever o texto utility-compliant
> conforme o item "Como amadurecer" abaixo, que continua válido.

**Adiado em:** 15/07/2026 · **Encerrado em:** 24/08/2026
**Era:** Etapa 2b — cron `farm-task-reminders` mandando o bot cobrar a tarefa/conta quando vence.

### Por que paramos

A Meta **reclassifica esses templates de UTILITY para MARKETING**. A regra: _utility_ não pode promover nem **incentivar novo engajamento** — qualquer cue promocional ou CTA derruba a categoria, mesmo com conteúdo transacional. Nossos templates tinham **os dois** gatilhos:

```
🔔 gerentia.app          ← header de marca  = brand awareness
Conta com {{1}} (R$ {{2}}) vence {{3}}.
Detalhes no app.         ← CTA             = engagement cue
```

**Consequências (a segunda é a que mata):**

|                    | Utility       | Marketing                           |
| ------------------ | ------------- | ----------------------------------- |
| Custo/msg (BR)     | ~R$ 0,04–0,05 | ~R$ 0,30–0,35 (**≈7–9x**)           |
| Opt-out do usuário | não se aplica | **sim** — pode **não ser entregue** |

O custo é o menor problema (mesmo a R$0,34, ~10 msgs/mês = R$3,40 vs. ticket de R$89). **O problema é entregabilidade:** marketing está sujeito a opt-out e limites por usuário — então o "sua conta vence amanhã" **pode simplesmente não chegar**, matando a função do recurso. Um lembrete que não é confiável é pior que nenhum.

**Agravante:** o classificador **não é determinístico**. O `farm_resumo_semanal` passou como UTILITY com **o mesmo padrão** que fez o `farm_alerta_vencimento` virar MARKETING. Ou seja, não dá pra garantir a categoria — o que torna o recurso instável por natureza.

**Contexto:** esse padrão **já mordeu em outros apps** (relato do Leonardo, 15/07). É um problema recorrente da plataforma, não um bug nosso.

### Estado atual (pra quem retomar)

- `farm_alerta_vencimento` — **APPROVED como MARKETING**. O cron existe e agora funciona, mas o envio está **desligado** por `ENVIO_PROATIVO_WHATSAPP` (24/08). Nunca chegou a enviar nada em produção. Quando voltar: reescrever utility-compliant num nome novo (`_v2`) — ou aposentar em favor de push nativo.
- `farm_resumo_semanal` — APPROVED **UTILITY** (sexta, cron `farm-weekly-summary`). Envio **desligado** pela mesma constante. Era o único canal do resumo, então a função deixou de existir — e como nunca funcionou, nada foi perdido. Refazer como notificação no app ou push quando houver push.
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

- **Consultor proativo** — resumo/insight gerado por IA (anomalias, tendências, fechamento de mês) em vez de template fixo. _Nota: esbarra no mesmo problema de push acima — o insight rico precisa da janela de 24h._
- **Onboarding conversacional no WhatsApp** — o "aha do dia 1" acontece no próprio bot. Ataca a **ativação**, que é o gargalo real do trial sem cartão.
- **Captura de comprovante Pix / print de banco** — reconhecer o padrão especificamente.
- **Cobrança de recebíveis** — o bot prepara a mensagem + link Pix pro cliente devedor.
- **Conciliação leve (import OFX)** — fecha o loop "bateu com o banco" sem o Pluggy (R$2,5k/mês fixo).
- **Camada fiscal (~R$169/mês)** — upsell futuro; só com demanda validada (ver [FARM-FISCAL-VIABILITY.md](FARM-FISCAL-VIABILITY.md)).

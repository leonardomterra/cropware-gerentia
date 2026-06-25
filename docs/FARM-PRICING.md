# Gerentia.app — Precificação Comercial

**Status:** DECIDIDO (V1 de preço) — billing ainda é stub, implementar quando sair do `501`.
**Origem:** sessão de precificação (12/06/2026) + revisão de marca/billing (25/06/2026).
**Relacionado:** [GERENTIA-BRAND.md](GERENTIA-BRAND.md) (público e voz), [FARM-ROADMAP.md](FARM-ROADMAP.md), [FARM-FISCAL-VIABILITY.md](FARM-FISCAL-VIABILITY.md) (camada fiscal = upsell).

> **Revisão 25/06/2026 (marca Gerentia).** Três decisões mudaram a base:
> 1. **Público** — de "produtor solo" para **profissional individual** (autônomo, liberal,
>    dono de negócio — agro incluso). O agro vira *uma prova entre várias*, não o argumento
>    mestre. Ver [GERENTIA-BRAND.md](GERENTIA-BRAND.md).
> 2. **Trial sem cartão** (era "com cartão"). Bate com o signup atual; menos atrito.
>    Implicação: a conversão recai toda no fim do trial — o "aha" do dia 1 e o resumo do
>    dia 10–12 viram o motor da venda, não bônus.
> 3. **Lojas day-1 com IAP** — iOS + Android publicam já, cobrança via RevenueCat (15%);
>    web via Mercado Pago (~5%). Mesmo preço nas duas frentes.
>
> R$89 num público amplo **se autosseleciona**: quem fatura justifica, o usuário de finança
> pessoal-hobby não converte — e tudo bem, ele não é o pagador.

---

## 0. Como usar este documento

Define **o que cobrar, de quem, quanto e como** no lançamento comercial do Gerentia.
Quando for implementar billing de verdade (hoje `billing.ts` retorna `501 / V2_billing`),
comece daqui. Não repete o estudo de viabilidade fiscal — só consome a conclusão de que
fiscal é camada paga futura, não parte do core.

**Tese de uma frase:**
> Um plano único **Pro a R$89/mês**, mirando o **profissional individual** (autônomo,
> liberal, dono de negócio — agro incluso), sem tier grátis (trial de 14 dias **sem
> cartão**), vendido por **valor** (zero planilha, nunca mais procurar uma nota) e não por
> custo. Fiscal é upsell futuro, nunca no Pro.

---

## 1. Princípio mestre: cobrar por valor, não por custo

O custo marginal por usuário ativo é baixo (Gemini OCR + OpenAI + Supabase = poucos
reais/mês). Precificar "custo + margem" deixa dinheiro na mesa — o teto real é a
**disposição a pagar** do público, não o custo. O profissional individual raciocina em
**quanto de dor isso tira** e **quanto deixei de perder**: a âncora é a dor ("nunca mais
procurar uma nota", "sei pra onde vai meu dinheiro"), não a lista de features.

Frase de validação (genérica — o agro é só um exemplo de prova):
> *"Você pagaria R$X/mês pra nunca mais procurar uma nota e saber, a qualquer momento, pra
> onde vai seu dinheiro?"*
> *(No nicho agro: "...e saber seu custo por hectare em tempo real?")*

---

## 2. Decisões fechadas

| Decisão | Escolha | Motivo |
|---|---|---|
| **Pagante-âncora** | **Profissional individual** (autônomo, liberal, dono de negócio — agro incluso) | R$89 se autosseleciona: quem fatura justifica. O agro é o caso de prova mais forte, não o teto. |
| **Eixo de cobrança** | **Flat por usuário** | Simples, previsível. Nunca por lançamento (puniria o hábito que retém). Seats viram add-on no futuro. |
| **Modelo de entrada** | **Trial 14 dias sem cartão** (sem grátis permanente) | Menos atrito pra público amplo. Implica: conversão recai toda no fim do trial — aha do dia 1 é obrigatório. |
| **Âncora de preço** | **R$89/mês** (faixa de valor) | Premium-acessível. R$99 fica como preço-cheio futuro (reajuste pós-1ª leva). |
| **Plataformas / lojas** | **Web (Mercado Pago) + iOS/Android (RevenueCat IAP) day-1** | Mesmo preço nas duas frentes; absorver os 15% das lojas. Ver §6 e §7. |
| **Fiscal (XML/NF-e/Open Finance)** | **Upsell futuro ~R$169/mês** | Não construir agora. Pluggy R$2,5k/mês fixo só sobrevive em tier caro. |

---

## 3. Tabela de preços (V1 de lançamento)

| | **Pro mensal** | **Pro anual** | **Founder** |
|---|---|---|---|
| Preço | R$89/mês | **R$890/ano** (~R$74/mês) | R$59/mês travado vitalício |
| Equivale a | — | 2 meses grátis (paga 10, leva 12) | -34% vitalício |
| Pra quem | entrada padrão | quem confia | primeiros 50-100 cadastros |

**Tudo incluso no Pro:** WhatsApp + IA (foto/áudio), Centros de Custo, dashboard,
recorrências, alertas de vencimento, exportação CSV, multi-dispositivo.

**Fiscal (futuro, ~R$169/mês):** upload XML NF-e, custo/ha, Open Finance (conciliação).
Só lançar quando houver demanda validada — ver [FARM-FISCAL-VIABILITY.md](FARM-FISCAL-VIABILITY.md).

---

## 4. Justificativa do R$89 no profissional individual (ROI)

Premium + sem cartão exige que o **onboarding** prove valor, não a tabela. Âncoras de venda
(da mais genérica pra mais nichada):

- **R$89/mês = menos de R$3/dia** pra nunca mais procurar uma nota e saber pra onde vai seu
  dinheiro. Âncora universal — vale pra qualquer profissional.
- **Nota perdida = imposto pago a mais.** Organizar canhoto/NF que viraria dedução já paga
  o mês. Vale pra autônomo, liberal, dono de negócio.
- **Tempo é o ativo.** Quem fatura não tem hora pra digitar planilha; a foto no WhatsApp
  devolve esse tempo.
- **(Prova agro) Custo/ha em tempo real** (quando o campo `hectares` no CC entrar): nenhuma
  planilha entrega isso sem trabalho. É a frase que fecha a venda *no nicho*.
- Copy: *"Substitui a planilha e a pasta de notas por uma foto no WhatsApp — por menos que
  um almoço por semana."*

Posicionamento: promessa oposta ao ERP/planilha — **zero tela cheia de campo, zero
planilha**. Vende simplicidade premium, não software barato.

---

## 5. Mecânica do trial (crítica — não há grátis, e não há cartão na entrada)

**Sem cartão na entrada** (decisão 25/06): menos atrito pra público amplo, mas a conversão
**não acontece sozinha** — ela recai 100% no fim do trial. Por isso os passos 2 e 3 deixam
de ser bônus e viram obrigatórios. Sequência:

1. **14 dias do Pro completo, sem cartão.** Cadastro pede só nome/e-mail/senha. (Schema já
   tem `trial_started_at` / `trial_ends_at` de 14 dias.) **Risco assumido:** entra curioso
   de baixa intenção — os passos abaixo é que filtram e convertem.
2. **Aha em <5 min (inegociável):** onboarding leva o usuário a **mandar a 1ª foto de recibo
   pelo WhatsApp e ver o lançamento aparecer** no dia 1. Esse momento vende — não o tour de
   features. Sem aha, o sem-cartão vira ralo.
3. **Dia 10-12:** mensagem "seu resumo até aqui" (total lançado, top categorias) — mostra
   valor acumulado antes de pedir o cartão.
4. **Fim do trial:** pedir o cartão oferecendo o **anual** com o gancho dos 2 meses grátis
   (e o **founder** enquanto a cohort estiver aberta). É aqui que a venda fecha.

---

## 6. Detalhes operacionais que mordem se ignorados

- **iOS — Apple leva 15%** (qualifica no Small Business Program, <US$1M). R$89 → ~R$76
  líquido no iPhone vs ~R$85 no web (Mercado Pago ~4-5%). **Decisão: mesmo preço em todas
  as frentes, absorver os 15%.** Simplicidade > 15% num ticket pequeno.
- **Android — Google Play leva 15%** em assinaturas. Mesma lógica do iOS. O Brasil tem
  *user choice billing* (checkout próprio ao lado do Google, ~4 p.p. de desconto), mas
  adiciona complexidade — **só avaliar se a taxa pesar**; no day-1, Play Billing puro via
  RevenueCat.
- **Regra das lojas inegociável:** no iOS **e** na Play, billing via RevenueCat (StoreKit /
  Play Billing). **Nunca** linkar Mercado Pago, site ou preço externo na UI do app
  (rejeição automática na Apple; viola política na Google). O web mais barato existe, mas o
  app não pode *direcionar* pra ele. Ver blueprint §10.5.
- **Pluggy (Open Finance): R$2,5k/mês fixo**, break-even ~50-83 users. **Nunca no Pro** —
  só no Fiscal, e só quando validado.
- **Founder's price travado** = melhor arma de prova social. Pedir depoimento em troca
  (caso de uso real — economia de tempo, nota recuperada, custo/ha no agro).
- **Reajuste:** após a 1ª leva, subir preço-cheio pra R$99-109 **para novos cadastros**,
  mantendo founders no R$59. Premia quem entrou cedo e cria urgência.

---

## 7. Arquitetura de billing (quando implementar)

Hoje `supabase/functions/gerentia-api/handlers/billing.ts` é stub (`501 / V2_billing`).
Quando cobrar de verdade (blueprint §10.5 detalha):

| Plataforma | Provider | Webhook |
|---|---|---|
| Web / PWA (e Android fora da Play) | Mercado Pago | `/gerentia-api/webhook/mp` |
| iOS nativo | RevenueCat (StoreKit) | `/gerentia-api/webhook/revenuecat` |
| Android na Play | RevenueCat (Play Billing) | `/gerentia-api/webhook/revenuecat` |

- **RevenueCat cobre iOS + Android num SDK só** — um webhook, dois stores. É o que reduz o
  trabalho de manter as duas lojas.
- Produtos: `gerentia_pro_monthly`, `gerentia_pro_yearly` (+ `gerentia_fiscal_*` no futuro).
  Mesmos product IDs mapeados no painel RevenueCat (App Store Connect + Play Console).
- Webhook atualiza `organizations.plan_code` + status de assinatura. **Fonte única de
  verdade do estado de assinatura** (vem do provider, não do client).
- Trial → ativo → cobrança: estado vem de `trial_ends_at` + webhook do provider.
- Webhooks públicos (`--no-verify-jwt`); validação de assinatura no handler.

**Sequência de implementação (não fazer tudo de uma vez):**
1. **Web (Mercado Pago) primeiro** — tira o `billing.ts` do stub, começa a faturar no web.
2. **RevenueCat (iOS + Android)** junto com o empacotamento Capacitor e a publicação nas
   lojas. Tela de conta iOS/Android sem links externos (regra das lojas, §6).
3. **Reconciliação de fonte** — `subscriptionSource` (`web_mp` | `ios_iap` | `android_iap`)
   pra esconder "gerenciar pagamento" onde a loja é dona da cobrança.

---

## 8. Próximos passos quando retomar

- [ ] **Validar R$89 com 5-8 profissionais** do público amplo (autônomo, liberal, dono de
      negócio, produtor) — disposição a pagar e reação ao "sem grátis".
- [ ] Tirar `billing.ts` do stub: **web/Mercado Pago primeiro** (faturar antes), webhooks reais.
- [ ] **Onboarding de trial com aha "foto → lançamento" no dia 1** — é o que sustenta o
      sem-cartão. Prioridade nº 1 antes de qualquer cobrança.
- [ ] Mensagem de resumo dia 10-12 + fluxo de pedir cartão no fim do trial (anual/founder).
- [ ] RevenueCat (iOS + Android) + publicação nas lojas, telas de conta sem links externos.
- [ ] Definir cohort founder (limite 50-100) e o mecanismo de trava vitalícia do R$59.
- [ ] (Nicho) campo `hectares` no CC → habilitar **custo/ha** como prova de venda no agro.

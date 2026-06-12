# Gerentia.app — Precificação Comercial

**Status:** DECIDIDO (V1 de preço) — billing ainda é stub, implementar quando sair do `501`.
**Origem:** sessão de precificação (12/06/2026) + decisões do usuário.
**Relacionado:** [FARM-ROADMAP.md](FARM-ROADMAP.md), [FARM-FISCAL-VIABILITY.md](FARM-FISCAL-VIABILITY.md) (camada fiscal = upsell).

---

## 0. Como usar este documento

Define **o que cobrar, de quem, quanto e como** no lançamento comercial do Gerentia.
Quando for implementar billing de verdade (hoje `billing.ts` retorna `501 / V2_billing`),
comece daqui. Não repete o estudo de viabilidade fiscal — só consome a conclusão de que
fiscal é camada paga futura, não parte do core.

**Tese de uma frase:**
> Um plano único **Pro a R$89/mês**, mirando o **produtor solo**, sem tier grátis (só
> trial de 14 dias com cartão), vendido por **valor** (custo/ha, zero planilha) e não por
> custo. Fiscal é upsell futuro, nunca no Pro.

---

## 1. Princípio mestre: cobrar por valor, não por custo

O custo marginal por org ativa é baixo (Gemini OCR + OpenAI + Supabase = poucos reais/mês).
Precificar "custo + margem" deixa dinheiro na mesa. O agro raciocina em **custo por hectare**
e **quanto deixei de perder**. Uma operação de 6 dígitos por safra paga R$89/mês sem piscar —
desde que a âncora seja a dor ("nunca mais procurar nota", "sei meu custo/ha em tempo real"),
não a lista de features.

Frase de validação (do doc fiscal, mantida):
> *"Você pagaria R$X/mês pra nunca mais procurar suas notas e saber seu custo por hectare?"*

---

## 2. Decisões fechadas

| Decisão | Escolha | Motivo |
|---|---|---|
| **Pagante-âncora** | **Produtor solo** | É a cunha de entrada. Consultor/revenda viram tier/add-on depois. |
| **Eixo de cobrança** | **Flat por organização** | Simples, previsível (agro gosta). Nunca por lançamento (puniria o hábito que retém). Seats viram add-on no futuro. |
| **Modelo de entrada** | **Só trial 14 dias** (sem grátis permanente) | Conversão limpa, menos custo de suporte. O trial **é** o funil. |
| **Âncora de preço** | **R$89/mês** (faixa de valor) | Posiciona perto de Aegro/Agropos no respeito, com promessa oposta (zero planilha). R$99 fica como preço-cheio futuro. |
| **Fiscal (XML/NF-e/Open Finance)** | **Upsell futuro ~R$169/mês** | Não construir agora. Pluggy R$2,5k/mês fixo só sobrevive em tier caro. |

---

## 3. Tabela de preços (V1 de lançamento)

| | **Pro mensal** | **Pro anual** | **Founder (1ª safra)** |
|---|---|---|---|
| Preço | R$89/mês | **R$890/ano** (~R$74/mês) | R$59/mês travado vitalício |
| Equivale a | — | 2 meses grátis (paga 10, leva 12) | -34% vitalício |
| Pra quem | entrada padrão | quem confia | primeiros 50-100 cadastros |

**Tudo incluso no Pro:** WhatsApp + IA (foto/áudio), Centros de Custo, dashboard,
recorrências, alertas de vencimento, exportação CSV, multi-dispositivo.

**Fiscal (futuro, ~R$169/mês):** upload XML NF-e, custo/ha, Open Finance (conciliação).
Só lançar quando houver demanda validada — ver [FARM-FISCAL-VIABILITY.md](FARM-FISCAL-VIABILITY.md).

---

## 4. Justificativa do R$89 no produtor solo (ROI)

Premium + solo exige que o **onboarding** prove valor, não a tabela. Âncoras de venda:

- **R$89/mês = menos de R$3/dia.** Ruído pra quem movimenta 6 dígitos por safra.
- **Nota perdida = imposto pago a mais.** Organizar canhoto/NF que viraria dedução já paga o ano.
- **Custo/ha em tempo real** (quando o campo `hectares` no CC entrar): nenhuma planilha
  entrega isso sem trabalho. É a frase que fecha a venda.
- Copy: *"Substitui a planilha e a pasta de notas por uma foto no WhatsApp — por menos que
  um almoço por semana."*

Posicionamento: respeito de Aegro/Agropos, promessa oposta — **zero tela cheia de campo,
zero planilha**. Vende simplicidade premium, não ERP barato.

---

## 5. Mecânica do trial (crítica — não há grátis)

Sem free, o trial converte sozinho. Sequência obrigatória:

1. **14 dias do Pro completo, com cartão na entrada** ("não cobramos nada hoje; 1ª cobrança
   em [data]"). Público premium não se incomoda; filtra curioso e melhora conversão vs.
   trial sem cartão. (Schema já tem `trial_started_at` / `trial_ends_at` de 14 dias.)
2. **Aha em <5 min:** onboarding leva o usuário a **mandar a 1ª foto de recibo pelo WhatsApp
   e ver o lançamento aparecer** no dia 1. Esse momento vende — não o tour de features.
3. **Dia 10-12:** mensagem "seu resumo da safra até aqui" (total lançado, top categorias) —
   mostra valor acumulado antes de cobrar.
4. **Fim do trial:** oferecer o **anual** com o gancho dos 2 meses grátis.

---

## 6. Detalhes operacionais que mordem se ignorados

- **iOS — Apple leva 15%** (qualifica no Small Business Program, <US$1M). R$89 → ~R$76
  líquido no iPhone vs ~R$85 no web (Mercado Pago ~4-5%). **Decisão: mesmo preço nas duas
  plataformas, absorver no iOS.** Simplicidade > 15% num ticket pequeno.
- **Regra Apple inegociável:** no iOS, billing via RevenueCat/StoreKit. **Nunca** linkar
  Mercado Pago, site ou preço fora da App Store na UI iOS (rejeição automática). Ver
  blueprint §10.5.
- **Pluggy (Open Finance): R$2,5k/mês fixo**, break-even ~50-83 users. **Nunca no Pro** —
  só no Fiscal, e só quando validado.
- **Founder's price travado** = melhor arma de prova social. Pedir depoimento de custo/ha
  em troca.
- **Reajuste:** após a 1ª leva, subir preço-cheio pra R$99-109 **para novos cadastros**,
  mantendo founders no R$59. Premia quem entrou cedo e cria urgência.

---

## 7. Arquitetura de billing (quando implementar)

Hoje `supabase/functions/gerentia-api/handlers/billing.ts` é stub (`501 / V2_billing`).
Quando cobrar de verdade (blueprint §10.5 detalha):

| Plataforma | Provider | Webhook |
|---|---|---|
| Web / PWA / Android | Mercado Pago | `/gerentia-api/webhook/mp` |
| iOS nativo | RevenueCat (StoreKit) | `/gerentia-api/webhook/revenuecat` |

- Produtos: `gerentia_pro_monthly`, `gerentia_pro_yearly` (+ `gerentia_fiscal_*` no futuro).
- Webhook atualiza `organizations.plan_code` + status de assinatura.
- Trial → ativo → cobrança: estado vem de `trial_ends_at` + webhook do provider.
- Ambos os webhooks públicos (`--no-verify-jwt`); validação de assinatura no handler.

---

## 8. Próximos passos quando retomar

- [ ] **Validar R$89 com 3-5 produtores** (disposição a pagar, reação ao "sem grátis").
- [ ] Implementar campo `hectares` no CC → habilitar **custo/ha** (o argumento de venda nº 1).
- [ ] Tirar `billing.ts` do stub: produtos Mercado Pago + RevenueCat, webhooks reais.
- [ ] Onboarding de trial com aha "foto → lançamento" no dia 1.
- [ ] Definir cohort founder (limite 50-100) e o mecanismo de trava vitalícia do R$59.

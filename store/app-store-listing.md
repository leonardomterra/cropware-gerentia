# App Store — ficha do Gerentia

Textos prontos pra colar no App Store Connect (*Apps → Gerentia → Distribuição da App Store / Informações do app*).
Respeitam os limites da Apple. Voz da marca: direto, "você", sem emoji. Espelha a
[ficha da Play](play-store-listing.md), adaptado pros campos da App Store.

> **Nota:** removida a menção a "verificação em duas etapas" (o bloco 2FA foi tirado do app).

---

## Nome  *(máx. 30 — único globalmente)*
```
Gerentia: Gestão Financeira
```

## Subtítulo  *(máx. 30)*
```
Controle financeiro por foto
```

## Texto promocional  *(máx. 170 — editável sem revisão)*
```
Fotografe a nota e pronto: o Gerentia lê valor, data e categoria e lança pra você. Painel, centros de custo e relatórios. Experimente grátis por 14 dias.
```

## Descrição  *(máx. 4000)*
```
Cansou de perder nota e não saber para onde vai o seu dinheiro? O Gerentia organiza suas finanças a partir de uma foto — sem planilha, sem digitar, sem complicação.

Tire uma foto do recibo e pronto: o Gerentia lê o valor, a data, o fornecedor e a categoria, e registra o lançamento para você. Tudo somado no painel, na hora.

Feito para quem cuida do próprio dinheiro — autônomos, profissionais liberais, pequenos negócios e produtores rurais.

O QUE VOCÊ FAZ NO GERENTIA
- Lançar por foto: fotografe a nota e deixe a inteligência artificial preencher.
- Ver tudo organizado: receitas e despesas por categoria e por centro de custo.
- Acompanhar o painel: quanto entrou, quanto saiu e com o quê.
- Separar por contexto: obra, projeto, fazenda ou área da vida, com centros de custo.
- Controlar o cartão: faturas sem contar o mesmo gasto duas vezes.
- Automatizar o que se repete: lançamentos recorrentes no automático.
- Lançar pelo WhatsApp: vincule seu número e registre gastos direto no chat.
- Guardar comprovantes: cada nota anexada e ligada ao seu lançamento.
- Exportar quando precisar: relatórios em PDF e CSV.

POR QUE GERENTIA
- Zero planilha. A foto é o produto.
- Clareza de verdade: responda "quanto gastei com isso?" na hora.
- Seus dados são seus: conta individual e exclusão de conta quando quiser.

Comece com uma foto. Experimente grátis por 14 dias.

A assinatura Gerentia Pro renova automaticamente pelo mesmo período até ser cancelada, gerenciável na sua conta da App Store.
Termos de Uso (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Política de Privacidade: https://gerentia.app/privacidade.html
```

## Keywords  *(máx. 100, separadas por vírgula, sem espaço após vírgula)*
```
finanças,despesas,gastos,recibo,nota,controle,orçamento,centro de custo,autônomo,fazenda,OCR
```
> Não repetir palavras do Nome ("gestão", "financeira") — a Apple já indexa o título.

---

## URLs
- **Support URL** (obrigatório): `https://gerentia.app`
- **Marketing URL** (opcional): `https://gerentia.app`
- **Privacy Policy URL** (obrigatório): `https://gerentia.app/privacidade.html`

## Categoria
- **Primária:** Finanças
- **Secundária** (opcional): Negócios ou Produtividade

## Screenshots (iPhone 6.9" — 1320×2868)
`~/Desktop/gerentia-screenshots/framed/` — as 5 com caption:
1. Dashboard · 2. Lançamentos · 3. Notas e Recibos · 4. Relatórios · 5. WhatsApp

## App Privacy (nutrition labels)
- **Dados coletados:** e-mail, nome, telefone (opcional), dados financeiros criados pelo usuário, fotos de comprovantes.
- **Uso:** funcionamento do app (organizar finanças, OCR por IA, suporte). **Vinculados à identidade**, mas **não usados para rastreamento (tracking)** e **não vendidos**.
- **Segurança:** criptografia em trânsito; permite excluir a conta.
- **Compras no app:** não (RevenueCat inerte; checkout web do Mercado Pago escondido no nativo). Atualizar quando ativar.

## Classificação etária
- Questionário → esperado **4+** (sem conteúdo sensível, sem anúncios).

## App Review Information  ⚠️ CRÍTICO
- **Sign-in required: SIM** → conta de demonstração dedicada (criada + populada com 6 meses de dados):
  - **Username:** `appstore.review@gerentia.app`
  - **Password:** `GerentiaReview2026!`
  - Org "Negócio Demonstração", trial ativo, 36 lançamentos (jan–jun/2026).
- **Contato:** nome, telefone, e-mail (contato@gerentia.app).
- **Notes:** "App de gestão financeira pessoal. Login por e-mail/senha. Trial de 14 dias. Lançamentos por foto (OCR), painel, centros de custo, relatórios. Sem compras no app."

## Export Compliance
- Info.plist já tem `ITSAppUsesNonExemptEncryption=false` → **sem questionário** de criptografia no envio.

## Preço  ⚠️ ler
- **Gratuito** — e é o **único válido** agora: o R$89 é cobrado por fora (Mercado Pago/web),
  e a Apple só cobra via In-App Purchase (StoreKit). Sem IAP implementado (RevenueCat inerte),
  não dá pra listar como pago.
- **Regra 3.1.1:** proibido mencionar/linkar o pagamento de R$89 dentro do app iOS (já escondido no nativo).
- Como nada bloqueia pós-trial, o app é funcionalmente grátis no iOS por ora.
- **Pra monetizar iOS no futuro:** ativar RevenueCat → criar assinatura como produto na App Store Connect
  (Apple cobra, fica 15–30%) → mapear no RevenueCat → gate pós-trial. Etapa à parte, num update.

# Gerentia.app — Viabilidade Fiscal & Inteligência Financeira

**Status:** PENDENTE — não implementar ainda. Documento de amparo para uma sessão futura.
**Origem:** estudo de viabilidade do usuário (02/06/2026) + análise crítica do Claude.
**Relacionado:** [FARM-ROADMAP.md](FARM-ROADMAP.md), estudo Open Finance (memória), pivot CC-only.

---

## 0. Como usar este documento

O estudo original (longo) propõe transformar o Gerentia de "app de lançamentos" em
**"CFO Virtual do Agro"**: financeiro + fiscal + safra + insumos + IA. Este doc não repete
o estudo inteiro — ele consolida **a decisão**: o que fazer, em que ordem, do que ter medo,
e por quê. Quando retomar, comece daqui em vez de reler o estudo do zero.

**Tese de uma frase:**
> Comprometa-se com **upload de XML de NF-e** como o próximo grande passo, ressignifique
> **CC como o eixo de inteligência** (hectares no CC → custo/ha), e trate todo o bloco de
> **certificado / NF-e automática** como uma fase **paga futura via parceiro** — nunca
> custódia própria de certificado.

---

## 1. A contradição central a resolver (CC-only × custo por hectare)

O Gerentia acabou de fazer o **pivot CC-only**: centro de custo virou o conceito universal
de organização financeira, e a Fazenda foi escondida do menu (simplificação radical).

O estudo, porém, vende como diferencial nº 1 o **"quanto gasto por hectare de soja na
Fazenda X, talhão 03"** — o que exigiria de volta fazenda + safra + cultura + talhão + área
como dimensões de primeira classe. **São visões opostas do produto.** Não dá pra ter as duas
ingenuamente.

### Reconciliação recomendada (o caminho)

Um **centro de custo já é** a safra/fazenda. Se o CC se chama *"Soja 2026 — Fazenda X"*,
então **custo-por-CC já é custo-por-safra**. A única coisa que falta pro "custo por hectare"
é um campo **`hectares` no próprio CC**:

```
custo/ha = (soma dos lançamentos do CC) ÷ (hectares do CC)
```

Isso entrega o indicador-estrela do estudo **sem trair o pivot** e **sem reintroduzir** a
árvore fazenda/talhão/cultura nem virar ERP. Conclusão importante: estamos **muito mais perto**
da "inteligência" do que o estudo sugere.

---

## 2. Priorização recomendada (difere da ordem do estudo)

| # | Feature | Custo | Benefício | Risco | Veredito |
|---|---|---|---|---|---|
| 1 | **Upload de XML de NF-e** | Baixo | Alto | Baixo | **Próximo passo** |
| 2 | **Custo/ha via CC** (campo `hectares` no CC) | Baixo | Alto | Baixo | Logo depois |
| 3 | **Import OFX/CSV + conciliação** | Médio | Médio-alto | Baixo | Sim |
| 4 | **Assistente IA "pergunte aos seus dados"** | Médio | Alto (percebido) | Médio | Sim (já no roadmap: ask-CC / ask-data) |
| 5 | NF-e automática + certificado | Alto | Alto | **Alto** | Só via parceiro, validar disposição a pagar antes |
| 6 | Estoque de insumos | Alto | Variável | Médio | Só após XML rodando + conexão Field/CDM |
| 7 | Radar de preços / Barter / CPR / crédito rural | Alto | Variável | Médio-alto | Não agora (ERP / bomba jurídica) |

### Por que XML é o vencedor óbvio
- **Reaproveita músculo já construído:** pipeline de extração de recibo por IA (Fases 2/3) e
  os line items (`farm_receipt_items`).
- **XML é estruturado** (vs. chute do OCR) → qualidade de classificação dá um salto.
- **Risco quase zero:** sem certificado, sem credencial sensível, sem LGPD pesada.
- É o "primeiro grande diferencial" com a menor distância até nós.

### Dados extraíveis do XML da NF-e
Chave, número, série, data de emissão, emitente/destinatário (CNPJ/CPF), produtos,
quantidades, unidades, valores unitários, valor total, NCM, CFOP, impostos, frete, desconto,
infos adicionais. → gera **pré-lançamento** + (futuramente) movimento de estoque.

---

## 3. Do que ter medo (defer agressivamente)

### 3.1. Custódia de certificado A1 — o monstro
No momento em que guardamos um `.pfx`/`.p12` de cliente, entramos em: LGPD séria
(consentimento específico, auditoria, revogação), responsabilidade jurídica, criptografia de
chave, superfície de ataque nova.
**Regra de ouro: nunca custodiar certificado próprio no começo.** Se um dia, é **via parceiro**.
Isso é "could have", não tão cedo.

### 3.2. Por que o caminho manual sobrevive mais tempo
O upload manual de XML **contorna quase toda** a complexidade fiscal/jurídica. Essa é a razão
estratégica de ficar no manual por mais tempo — não é preguiça, é gestão de risco.

### 3.3. Estoque, radar, barter
- **Estoque:** só vale com XML rodando + conexão Field/CDM. Pesado. Defer.
- **Radar de preços:** bomba jurídica (agregar dado de produtor/fornecedor) + precisa de massa
  crítica inexistente. Lá na frente, só com dados agregados/anonimizados e opt-out.
- **Barter / CPR / crédito rural:** território de ERP completo. Não agora.

---

## 4. Vulnerabilidades específicas do Gerentia (que o estudo genérico não sabe)

- **Supabase compartilhado com o Studio (piloto).** Documentos fiscais = muito storage +
  processamento + mais tabelas → mais RLS. E **RLS já mordeu antes** (regra: nunca subquery na
  própria tabela; usar função SECURITY DEFINER). Cada entidade fiscal nova aumenta a superfície
  de erro de isolamento entre orgs. **Em algum ponto, escala fiscal empurra pra fora do projeto
  compartilhado** — custo futuro previsível, não surpresa.
- **Dev solo.** Cada feature fiscal é buraco de coelho: variações de XML, CFOP, NCM, manifestação
  do destinatário, duplicidade por chave. XML "simples" **não** é tão simples. Uma feature fiscal
  por vez.
- **Privacidade na IA:** enviar só campos necessários ao modelo externo, mascarar CPF/CNPJ,
  evitar XML completo, usar regra determinística quando bastar.

---

## 5. O ângulo que falta no estudo: monetização

Fiscal **não é só custo — é o upsell.** O núcleo financeiro + XML pode ser barato/grátis pra
reter; o **"Plano Fiscal"** (NF-e automática) é onde se cobra prêmio.

Lógica de decisão: não se entra em fiscal por entusiasmo. Entra-se quando provar que
**(a) o core retém** e **(b) tem gente disposta a pagar pelo add-on.**

Pergunta de validação certa (3–5 produtores):
> *"Você pagaria R$ X/mês pra nunca mais precisar procurar suas notas?"*

---

## 6. Parceiros fiscais (para quando a Fase 5 entrar)

Detalhe completo em [FARM-FISCAL-PARTNERS.md](FARM-FISCAL-PARTNERS.md) (ou seção dedicada quando
criada). Resumo:

| Parceiro | Perfil | Quando faz sentido |
|---|---|---|
| **Nuvem Fiscal** | API-first, moderna, distribuição NF-e (NFeDistribuicaoDFe), modelo pay-as-you-go | **Default pro piloto técnico** |
| **Focus NFe** | API conhecida, recebimento NF-e/CT-e + manifestação, simples | Bom pro MVP fiscal pela simplicidade |
| **TecnoSpeed / PlugNotas** | Robusto, emissão+armazenamento+consulta+distribuição | Se ampliar pra emissão/integrações complexas |
| **NFE.io** | Emissão e consulta, posicionamento SaaS | Alternativa/complemento |
| **SIEG / Arquivei** | Foco em captura/gestão de XML em massa, manifestação | Avaliar se o gargalo for volume de captura |

**Princípio:** começar com **upload manual** (sem parceiro). Parceiro entra **só** na fase de
NF-e automática, sempre custodiando o certificado **no parceiro**, não no Gerentia.

---

## 7. Roadmap fiscal em camadas (resumo do estudo, validado)

1. **Núcleo financeiro** (já existe em grande parte): lançamentos, contas a pagar/receber, CC, dashboard.
2. **Upload + leitura de XML** ← *próximo grande passo*.
3. **OFX/CSV + conciliação.**
4. **IA:** classificação, custo/ha, alertas, perguntas em linguagem natural.
5. **Piloto de NF-e automática via parceiro fiscal** (certificado no parceiro, termos, auditoria).
6. **CFO Virtual do Agro** (visão longo prazo: diagnóstico, projeção de caixa, cenários).

---

## 8. Próximos passos concretos quando retomar

- [ ] **Mapear upload de XML contra o schema atual** (`farm_receipt_items`, `receiptLines()`,
      promote) — medir distância real.
- [ ] Desenhar a reconciliação **CC ↔ custo/ha** (campo `hectares` no CC, telas, relatório).
- [ ] **Validação comercial** com 3–5 produtores: coletar XMLs reais, medir tempo economizado,
      testar disposição a pagar pelo módulo fiscal.
- [ ] Só então: comparar parceiros fiscais a fundo e decidir piloto.

# Gerentia.app — Parceiros Fiscais & Matriz de Cotação

**Status:** PENDENTE — referência para a fase de NF-e automática. Não contratar nada agora.
**Pai:** [FARM-FISCAL-VIABILITY.md](FARM-FISCAL-VIABILITY.md) (decisão e priorização).
**Regra de ouro:** começar **sem parceiro** (upload manual de XML). Parceiro só na fase de
captura automática, e a **custódia do certificado fica SEMPRE no parceiro**, nunca no Gerentia.

---

## 1. Que problema o parceiro resolve (contexto)

Para o Gerentia, "NF-e automática" = **buscar as notas emitidas *contra* o CPF/CNPJ do
produtor** (notas de **compra**: fertilizante, defensivo, semente, peça, frete). Isso passa pelo
serviço oficial da SEFAZ **NFeDistribuicaoDFe**. Falar direto com a SEFAZ exige certificado
ICP-Brasil no servidor, controle de **NSU** (sequência de cada documento, pra não re-baixar),
tratamento de eventos, **manifestação do destinatário** e variação por UF.

O parceiro abstrai isso em até 3 camadas:
1. **Distribuição/captura** — "me dá todas as NF-e que entraram contra esse CNPJ" via REST/webhook, tratando NSU.
2. **Manifestação** — confirmar/recusar a operação na SEFAZ (às vezes obrigatório pra liberar o XML completo).
3. **Custódia de certificado** — o parceiro guarda o A1 (tira a maior responsabilidade jurídica do Gerentia).

---

## 2. Candidatos — o que cada um agrega

### Nuvem Fiscal — *default pro piloto*
- API-first moderna, doc limpa, endpoints diretos de distribuição (pedido, resumo, manifestação, download XML).
- Cobrança **pay-as-you-go / por consumo** — baixo atrito pra validar com poucos produtores.
- Custódia do A1 na conta deles. **Menor risco e menor compromisso fixo.**

### Focus NFe — *o simples e conhecido*
- API madura e popular; recebimento de NF-e **e CT-e** (frete, relevante no agro) + manifestação.
- Forte candidato a MVP fiscal pela simplicidade.
- *Atenção:* historicamente mais voltado a **emissão** — confirmar cobertura de distribuição/CT-e no plano.

### TecnoSpeed / PlugNotas — *o robusto*
- Emissão + armazenamento + consulta + distribuição; empresa consolidada, suporte forte.
- Faz sentido **só se** o Gerentia um dia for emitir/escriturar. Para só *capturar* nota de compra, é peso e custo a mais.

### NFE.io — *alternativa/complemento*
- Emissão e consulta, posicionamento dev/SaaS. Boa como segunda cotação de preço/cobertura. Sem diferencial específico pro caso de captura.

### SIEG — *especialista em captura em massa*
- Foco em capturar XML em volume + gestão de manifestação; muito usado por contabilidades.
- Tende a sair **barato por documento**. Bom se o gargalo virar volume / cenário "contador".

### Arquivei — *produto pronto de gestão de XML*
- Captura automática de XML a partir do certificado, mais "painel pronto" que "API pura".
- Confirmar se a **API** atende ou se é orientado ao produto deles.

### Alternativa zero (sem fornecedor)
- **Upload manual de XML** — custo zero, custódia zero, risco zero. É onde se começa de qualquer jeito.

---

## 3. Ordem prática de escolha

1. **Fase manual:** nenhum parceiro.
2. **Piloto automático:** Nuvem Fiscal (pay-as-you-go + custódia) **ou** Focus NFe (simplicidade). POC com **1 produtor real + certificado real**.
3. **Se escalar volume / contador:** comparar SIEG / Arquivei por custo/documento.
4. **Só se for emitir nota um dia:** TecnoSpeed / PlugNotas.

> Preço público desses serviços raramente é confiável — todos têm faixa por documento/mês que
> só fecha em call comercial (mesma lição do estudo de Open Finance). Cotar antes de assumir.

---

## 4. Matriz de cotação — perguntas a disparar pra cada parceiro

Copiar/colar e enviar igual pra todos, pra comparar maçã com maçã.

### A. Escopo e cobertura
- [ ] Vocês fazem **distribuição de NF-e de entrada** (NFeDistribuicaoDFe) — notas emitidas *contra* o CNPJ do meu cliente? (Não estou falando de emissão.)
- [ ] Cobre **CT-e** (frete) além de NF-e?
- [ ] Cobre **NFC-e / NF3e / outros DF-e**? (Pode ser irrelevante agora, mas bom saber.)
- [ ] Há limitação de **UF**? Algum estado problemático?
- [ ] Entregam o **XML completo** ou só o **resumo** (que exige manifestação pra liberar o completo)?

### B. Manifestação do destinatário
- [ ] A API faz **manifestação** (ciência / confirmação / desconhecimento / não realizada)?
- [ ] Manifestação é **necessária** pra baixar o XML completo no fluxo de vocês? É automatizável?

### C. Captura e entrega (modelo técnico)
- [ ] Entrega via **webhook (push)** ou só **polling (pull)**? Qual a frequência/latência típica até a nota aparecer?
- [ ] Vocês **gerenciam o NSU** por CNPJ (controle de duplicidade) ou isso fica do meu lado?
- [ ] Tem **idempotência** / dedupe por chave de acesso?
- [ ] Qual o **histórico/retenção** do XML armazenado por vocês? Por quanto tempo? Custa à parte?

### D. Certificado digital (o ponto crítico)
- [ ] Vocês fazem **custódia do certificado A1** do meu cliente? Onde fica armazenado, criptografado como?
- [ ] Como é o **upload/rotação/revogação** do certificado via API?
- [ ] Têm certificação de segurança (SOC 2, ISO 27001) e cláusula de **LGPD / operador de dados**?
- [ ] Suportam **certificado em nuvem**? A3?

### E. Comercial e preço
- [ ] Modelo: **por documento**, **por CNPJ/mês**, **fixo + excedente** ou **pay-as-you-go**?
- [ ] Tem **setup fee** / taxa de adesão / mínimo mensal?
- [ ] Existe **sandbox/trial** gratuito pra POC? Por quanto tempo, com quais limites?
- [ ] Preço escala como? Faixa pra ~5, ~50 e ~200 CNPJs.
- [ ] Tem modelo **revshare** ou plano "startup" em vez de fixo alto?

### F. Operação, SLA e suporte
- [ ] **SLA** de disponibilidade da API? Histórico de uptime / status page?
- [ ] **Rate limits**? Comportamento quando a SEFAZ está fora (fila, retry)?
- [ ] Canal de **suporte técnico** (e tempo de resposta) durante integração?
- [ ] Qualidade da **documentação** e exemplos? SDK em Node/Deno (compatível com Supabase Edge Functions)?

---

## 5. Tabela comparativa (preencher após cotação)

| Critério | Nuvem Fiscal | Focus NFe | PlugNotas | NFE.io | SIEG | Arquivei |
|---|---|---|---|---|---|---|
| Distribuição NF-e entrada | ? | ? | ? | ? | ? | ? |
| CT-e (frete) | ? | ? | ? | ? | ? | ? |
| Manifestação via API | ? | ? | ? | ? | ? | ? |
| Webhook (push) | ? | ? | ? | ? | ? | ? |
| Gerencia NSU/dedupe | ? | ? | ? | ? | ? | ? |
| Custódia do A1 | ? | ? | ? | ? | ? | ? |
| LGPD / cert. segurança | ? | ? | ? | ? | ? | ? |
| Modelo de preço | pay-as-you-go? | ? | ? | ? | por doc? | ? |
| Setup / mínimo mensal | ? | ? | ? | ? | ? | ? |
| Sandbox/trial | ? | ? | ? | ? | ? | ? |
| SLA / status page | ? | ? | ? | ? | ? | ? |
| SDK Node/Deno | ? | ? | ? | ? | ? | ? |
| **Veredito** | | | | | | |

---

## 6. Critérios de eliminação rápida (pra não perder tempo)

Descartar logo um parceiro se:
- **Não** faz distribuição de entrada (só emissão) — não serve pro caso central.
- **Não** custodia o certificado **ou** não tem cláusula LGPD/segurança decente — risco alto demais.
- Exige **fixo mensal alto** sem trial — inviável pro piloto de poucos produtores (ver break-even do Open Finance).
- Sem **sandbox** pra POC — não dá pra validar NSU/manifestação no mundo real antes de assinar.

---

## 7. Antes de qualquer contrato

- [ ] Core do Gerentia provou **retenção** (não entrar em fiscal por entusiasmo).
- [ ] Validado com **3–5 produtores** que pagariam pelo módulo fiscal.
- [ ] **POC técnica** com 1 certificado real concluída (NSU, manifestação, latência testados).
- [ ] Termo de autorização + política de privacidade + fluxo de **revogação** prontos.

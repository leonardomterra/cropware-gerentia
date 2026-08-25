# Bateria de testes do WhatsApp

> **Estado: NÃO EXECUTADA.** Criada em 25/08/2026, logo depois da etapa 4 de
> `CARTOES-E-FATURAS.md`. Leonardo vai rodar em outro momento.
>
> Marque cada linha com ✅ / ❌ conforme for testando, e anote embaixo o que
> falhou. Um teste que passou "mais ou menos" é ❌ — a dúvida some com o tempo,
> o bug não.

O bot é o caminho de entrada mais usado do app e o único que roda **sem tela**:
quando ele erra, o usuário não vê o erro, vê um lançamento errado. Por isso vale
a bateria inteira, e não só o que mudou.

---

## 0. Antes de começar

**Use um número vinculado a uma organização de teste**, não a Querência. Vários
testes criam lançamento de verdade, e limpar depois dá mais trabalho do que
preparar antes.

**Para os testes de cartão, tenha DOIS cartões ativos cadastrados.** Boa parte
do que mudou na etapa 4 só aparece com dois — com um só o sistema resolve
sozinho e não pergunta nada (isso é proposital, e o teste 5.2 confirma).

**Cada mensagem interativa expira.** Se demorar entre um passo e outro, o bot
responde "essa escolha expirou" — não é bug, é o `farm_wa_pending` sendo
consumido. Refaça o fluxo do começo.

**Onde olhar quando falhar:**

```bash
npx supabase functions logs gerentia-api --project-ref ttnsywnwjybrrtykoqxr
```

As linhas do bot têm prefixo `[wa]`. Erro de insert aparece inteiro ali.

---

## 1. Foto — o caminho principal

| # | O que mandar | O que esperar |
|---|---|---|
| 1.1 | Foto de **cupom fiscal** simples | Resumo com valor, estabelecimento, categoria e centro. Botões Confirmar / Mudar centro / Editar no app |
| 1.2 | Confirmar o 1.1 | "Lançamento salvo" com valor, categoria, data e status |
| 1.3 | Foto de **nota com 2+ produtos** | Resumo diz "N itens" e lista os primeiros; o total é a SOMA dos itens |
| 1.4 | Confirmar o 1.3 | Salva itemizado. No app, o lançamento mostra os itens, cada um com sua categoria |
| 1.5 | Foto de **comprovante de PIX** | Nasce com status **pago** (✅ no fim da linha), não "a pagar" |
| 1.6 | Foto **sem forma de pagamento visível** | Pergunta a forma numa LISTA antes de confirmar |
| 1.7 | Foto **sem data legível** | Depois de confirmar, pergunta a data (Hoje / Ontem / Digitar) |
| 1.8 | No 1.7, escolher "Digitar" e mandar `12/08` | Aceita e salva com 12/08 do ano corrente |
| 1.9 | Foto **borrada / ilegível** | Recusa com mensagem clara, sem inventar valores |
| 1.10 | **PDF** em vez de foto | Mesmo fluxo da foto |

### Mudar centro de custo

| # | | |
|---|---|---|
| 1.11 | No resumo, tocar "Mudar centro" | Lista os centros que **aquele usuário** pode usar — não todos da organização |
| 1.12 | Escolher outro centro e confirmar | Salva no centro escolhido; em nota itemizada, vale para todos os itens |

---

## 2. Reconciliação (dar baixa em conta aberta)

Este fluxo é anterior aos cartões e **não pode ter quebrado**.

| # | O que mandar | O que esperar |
|---|---|---|
| 2.1 | Crie uma conta a pagar no app. Mande a foto do comprovante dela | O bot RECONHECE e oferece dar baixa, em vez de criar lançamento novo |
| 2.2 | Aceitar a baixa | A conta vira "pago"; **não** aparece um segundo lançamento |
| 2.3 | Recusar a baixa | Segue o fluxo normal e cria lançamento separado |

---

## 3. Texto — o agente

Mande em linguagem natural. As ferramentas que ele tem:

| # | Exemplo de mensagem | O que esperar |
|---|---|---|
| 3.1 | `gastei 250 no posto ipiranga hoje` | Cria despesa; pode abrir o wizard pedindo o que faltar |
| 3.2 | `recebi 12000 da venda de soja ontem` | Cria receita, categoria `venda_graos` |
| 3.3 | `quanto gastei esse mês?` | Resumo com total, sem inventar número |
| 3.4 | `meus lançamentos da semana` | Lista |
| 3.5 | `quanto gastei com combustível?` | Gasto por categoria |
| 3.6 | `compara esse mês com o passado` | Comparação de períodos |
| 3.7 | `marca a conta da Cemig como paga` | Marca pago |
| 3.8 | `anota: pagar o contador dia 10` | Cria pendência |
| 3.9 | `já paguei o contador` | Conclui a pendência |
| 3.10 | `cancela o último lançamento` | Cancela |
| 3.11 | `quais são meus centros de custo?` | Lista só os permitidos ao usuário |

### O wizard

Quando falta informação, o bot pergunta passo a passo: **categoria → centro →
origem → forma de pagamento → status → vencimento → observações.**

| # | | |
|---|---|---|
| 3.12 | Percorrer o wizard até o fim | Salva com tudo que foi respondido |
| 3.13 | Tocar "Cancelar" no meio | Descarta; **nada** é criado |

---

## 4. Permissões

| # | | |
|---|---|---|
| 4.1 | Testar com usuário **membro** | Vê e cria só o que é dele |
| 4.2 | Testar com **gestor** | Vê o consolidado da organização |
| 4.3 | Mandar mensagem de número **não vinculado** | Recusa educada, sem vazar dado nenhum |

---

## 5. Cartões e faturas — o que mudou na etapa 4

**É aqui que está o risco desta rodada.** Nada disso existia antes de 25/08/2026.

### Compra no crédito

| # | O que mandar | O que esperar |
|---|---|---|
| 5.1 | Com **2+ cartões ativos**: foto de compra no crédito | Depois da forma de pagamento, PERGUNTA em qual cartão, com nome e 4 dígitos |
| 5.2 | Com **1 cartão ativo**: mesma foto | **NÃO** pergunta nada. Salva já vinculado àquele cartão |
| 5.3 | Com **nenhum cartão**: mesma foto | Não pergunta e salva sem cartão. Não pode dar erro |
| 5.4 | Conferir o 5.1 no app | O lançamento aparece com o cartão escolhido, e **não soma** no total (é informativo) |

### Fatura

| # | O que mandar | O que esperar |
|---|---|---|
| 5.5 | Foto de **fatura** com os 4 dígitos legíveis | Identifica o cartão SOZINHO, sem perguntar |
| 5.6 | Foto de fatura **sem os dígitos legíveis**, com 2+ cartões | Pergunta de qual cartão é |
| 5.7 | Confirmar uma fatura | Mensagem começa com "**Fatura salva**", mostra o cartão e o resumo da conciliação |
| 5.8 | O resumo | "N compras desta fatura você não tinha lançado" e/ou "N compras lançadas no cartão não vieram nesta fatura" |
| 5.9 | Mandar **a mesma fatura de novo** | "Essa fatura já está lançada" — não pode criar a segunda |
| 5.10 | Conferir a fatura no app | Competência preenchida com o mês do FECHAMENTO (não o do vencimento) |
| 5.11 | Abrir a fatura no app | Os itens têm DATA. É o critério que o WhatsApp descartava antes da etapa 4 |
| 5.12 | Comparar o resumo do bot com a tela | Os números têm que bater — é a mesma `lib/conciliacao.ts` |

### Conferência no banco

Depois de 5.7, confirme que os campos novos foram gravados:

```sql
select r.id, r.doc_type, r.competencia, c.nome as cartao,
       count(i.id) as itens,
       count(i.purchase_date) as itens_com_data
  from public.farm_receipts r
  left join public.farm_cards c on c.id = r.card_id
  left join public.farm_receipt_items i on i.receipt_id = r.id
 where r.source = 'whatsapp' and r.doc_type = 'fatura'
 group by 1,2,3,4
 order by r.created_at desc limit 5;
```

**`cartao` nulo** ou **`itens_com_data` = 0** significa que a etapa 4 não pegou —
e o segundo é exatamente o defeito que ela consertou.

---

## 6. O que sabidamente NÃO está coberto

- **Os 4 dígitos dependem da Gemini lê-los na foto.** Se ela errar ou não achar,
  o fluxo cai no caso "um cartão só" e funciona igual; com dois cartões, vai
  perguntar. Não é falha, mas vale saber por que perguntou.
- **Competência fica nula** se o cartão não tiver dia de fechamento e vencimento
  cadastrados. Sem os dois não há como derivar, e o índice que impede fatura
  duplicada é parcial justamente para tolerar isso — ou seja, **sem os dias, a
  trava anti-duplicidade não protege**. Cadastre os dias.
- **Fatura de cartão de DÉBITO não existe.** Débito não entra nesta história.

---

## 7. Anotações da execução

_(preencha ao rodar)_

| data | quem | o que falhou |
| ---- | ---- | ------------ |
|      |      |              |

# Cartões e faturas — gerentia.app

**Início:** 25/08/2026 · **Etapa 1 concluída** em 25/08/2026 · **Próxima:** 2 (cadastro de cartões)

Documento-contrato. Mudança de regra se decide aqui antes de virar código.

---

## 1. O problema

Até 25/08/2026 a conta era: **a compra no cartão soma, a fatura não.** A ideia
era evitar contagem dupla — o gasto entra pelas compras, e a fatura é só o
documento que as agrupa.

Funciona no papel e **não funciona na prática**, por um motivo simples: uma
fatura tem muito mais coisa do que o usuário vai cadastrar. A geladeira em 18
vezes, o airfryer em 12, a academia, a internet, o streaming. Ninguém tem tempo
de lançar tudo isso como recorrência.

Então o total sempre fica com um buraco, e o buraco é do tamanho do que o
usuário não teve paciência de digitar. Nunca fecha com o extrato do banco.

### O app já se contradizia

Antes da mudança, o WhatsApp respondia a uma compra no cartão com _"Vai fechar
na fatura"_ (`handlers/whatsapp.ts`) e o comentário do código dizia _"Crédito
NÃO conta — sai via fatura"_. Mas `counts_in_total` era gravado como `true`.

O app dizia uma coisa e calculava outra. A inversão não muda o rumo — faz o
cálculo obedecer o que já estava escrito na tela.

## 2. A regra nova

> **A fatura é o lançamento. As compras no cartão são o extrato.**

| lançamento                                                  | conta?                |
| ----------------------------------------------------------- | --------------------- |
| `doc_type = "fatura"`                                       | **sim**               |
| compra com `payment_method = "cartao_credito"`              | **não** — informativa |
| todo o resto (PIX, dinheiro, débito, boleto, transferência) | sim                   |

**Boleto e débito automático seguem contando na compra**, de propósito: ali o
lançamento JÁ É a conta, e pagá-la é o mesmo documento. Não existe um segundo
papel chegando depois.

**O `cartao` genérico (legado) também segue contando.** Ele é ambíguo — pode ser
crédito ou débito. Entre dois erros possíveis, escolhemos o visível: contar duas
vezes aparece no total e o usuário desliga no formulário; não contar some em
silêncio. O WhatsApp já pergunta a forma de pagamento quando ela chega assim.

O toggle "Contabilizar no total" continua existindo para os dois lados — o que
mudou foi o padrão.

## 3. Granularidade: a fatura conta pelos ITENS

Se a fatura contasse como uma linha só, todo o gasto de cartão viraria uma
categoria só e o relatório "Onde mais saiu" perderia o cartão inteiro. Numa
ferramenta de finanças isso é regressão, não simplificação.

A fatura conta **pelos itens**: cada compra dentro dela com sua categoria, e o
total batendo com a fatura por construção. O motor já existe (`farm_receipt_items`
e o "desmembrar"), e o prompt de OCR já extrai: _"FATURA de cartão de crédito:
CADA COMPRA da fatura vira um item"_.

Uma fatura lançada à mão ("paguei 1.500 do Mastercard") fica com uma linha só.
É a troca consciente de detalhe por velocidade.

## 4. O que a inversão conserta de graça

Dashboard e Relatórios **não precisam de mudança nenhuma**: os quatro cálculos do
dashboard (KPIs, gráfico, projeção, Próximos Vencimentos) e o dos relatórios já
filtram por `counts_in_total`.

Um efeito colateral bom: hoje a compra no cartão nasce `a_pagar` e aparece em
**"A pagar"** e em **"Próximos Vencimentos"**, como se fosse uma conta a pagar —
e não é, é uma linha de uma fatura futura. Virando informativa, ela sai das duas
sozinha. Um flag conserta três telas.

## 5. Histórico

**Nada do passado muda** (decisão de 25/08/2026). A regra vale para lançamentos
novos; os antigos ficam como estão.

Isso cria uma emenda na série histórica — meses antigos com a lógica velha,
novos com a nova. É barato: o app tem poucos meses de uso e dois clientes
ativos, e o alternativo seria pior — migrar mudaria totais de meses já fechados,
e onde o cliente não cadastrou a fatura antiga o gasto do cartão sumiria do
histórico dele.

## 5b. Fatura não desmembra

Existia um "desmembrar": um item da fatura virava lançamento próprio que soma, e
o valor era **subtraído do total do pai**. Era o jeito de puxar para o total um
gasto que a fatura informativa escondia.

**Aposentado em 25/08/2026**, por dois motivos que se somam:

1. O buraco que ele tapava não existe mais — a fatura soma inteira.
2. A fatura passou a ser **o número que fecha com o extrato do banco**, e mexer
   no total dela é falsificar o documento: uma fatura de R$ 1.500 com três itens
   desmembrados passaria a dizer R$ 1.200. **Fatura fechada não perde item.**

Segue valendo para nota e cupom, onde não existe um extrato para conferir.

O front esconde a ação (em vez de mostrá-la desabilitada, o que prometeria algo
impossível naquele documento) e o backend recusa com `fatura_nao_desmembra` —
porque esconder botão não é regra, é sugestão.

## 5c. Os itens da fatura NÃO vão para Lançamentos

Uma fatura de quem passa tudo no cartão traz 200 compras. Se elas aparecessem na
lista de Lançamentos, ela viraria ilegível.

**Já é assim hoje** e não precisou de mudança: a lista renderiza uma linha por
LANÇAMENTO, nunca por item. A fatura aparece como uma linha com o selo
"Fatura — 200 itens"; as compras existem só dentro dela.

A regra que fica, para a etapa 5:

> A compra informativa que o usuário lançou fica em **Lançamentos**.
> A linha que veio da fatura fica **dentro da fatura**.
> A conciliação **liga as duas**, e não cria uma terceira.

**Pendência conhecida:** a lista busca `*, items(*)`, então os 200 itens viajam
para o navegador em toda carga só para o selo mostrar o número. Some da tela e
vira lentidão sem causa aparente. Resolver junto da etapa 3.

## 6. Etapas

|       | o que                                                          | estado        |
| ----- | -------------------------------------------------------------- | ------------- |
| **1** | Inverter a regra, ajustar os textos, aposentar o desmembrar    | ✅ 25/08/2026 |
| **2** | Cadastro de cartões (tabela + `card_id` no lançamento)         |               |
| **3** | Aba **Cartões**: hub no molde de Configurações                 |               |
| **4** | WhatsApp: escolher cartão, registrar fatura                    |               |
| **5** | Conciliação: casar itens da fatura com as compras informativas |               |

A etapa 1 vem primeiro porque é pequena e já fecha o buraco: a partir da próxima
fatura lançada, o total bate. As demais são estrutura.

## 7. Ideias para as etapas seguintes

**Conciliação (etapa 5) é onde está o valor de verdade.** Quando a fatura é lida
por foto, casar cada item dela com a compra informativa que o usuário já
registrou (valor + data + estabelecimento). O que casa vira detalhe; **o que não
casa é o que ele nunca registrou** — e é isso que ele quer descobrir.

**Fatura tem duas datas, não uma.** Fechamento e vencimento são coisas
diferentes, e sem separá-las "a fatura de agosto" é ambíguo. O cadastro do
cartão guarda o dia de cada um e o resto se deriva.

**Cuidado com duplicidade na etapa 3.** Com a fatura entrando por foto E podendo
ser cadastrada à mão na aba Cartões, é preciso barrar a mesma fatura entrando
duas vezes — provavelmente por (cartão + mês de referência).

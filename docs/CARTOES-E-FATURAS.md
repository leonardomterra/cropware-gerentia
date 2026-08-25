# Cartões e faturas — gerentia.app

**Início:** 25/08/2026 · **Etapas 1 a 3 concluídas** em 25/08/2026 · **Próxima:** 4 (WhatsApp)

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
| **2** | Cadastro de cartões (tabela + `card_id` no lançamento)         | ✅ 25/08/2026 |
| **3** | Aba **Cartões**: hub no molde de Configurações                 | ✅ 25/08/2026 |
| **4** | WhatsApp: escolher cartão, registrar fatura                    |               |
| **5** | Conciliação: casar itens da fatura com as compras informativas |               |

A etapa 1 vem primeiro porque é pequena e já fecha o buraco: a partir da próxima
fatura lançada, o total bate. As demais são estrutura.

## 6b. O modelo de cartões (etapa 2)

**O cartão é da PESSOA, dentro de uma organização.** Na prática o "cartão
corporativo" vem no nome do colaborador. O gestor **consulta** todos e opera só
o dele.

Essa regra não é nova: é exatamente o que `farm_can_read_all()` e
`farm_can_write_others()` já produzem para lançamentos. As policies de
`farm_cards` reusam as duas — se um dia o interruptor de `farm_can_write_others`
virar `true`, os cartões acompanham sem ninguém lembrar de mexer lá.

| decisão                                             | por quê                                                                                                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id` com **SET NULL**                          | é atribuição, não posse. Apagar a pessoa não pode levar o cartão e orfanar as faturas — a lição do CASCADE em `farm_categories`, que apagaria 67 categorias do cliente |
| Ao desvincular, o cartão **fica com a organização** | mesmo tratamento dos lançamentos: as faturas presas a ele são da empresa                                                                                               |
| **Dois dias**, fechamento e vencimento              | sem separá-los, "a fatura de agosto" é ambíguo                                                                                                                         |
| `ultimos_digitos` como **texto**                    | zero à esquerda é significativo: "0042" ≠ 42                                                                                                                           |
| `bandeira` e `emissor` **sem check**                | a lista cresce (bandeiras regionais, private label) e cada acréscimo exigiria migração. Quem restringe é o `<select>`                                                  |
| Cartão cancelado **desativa**, não apaga            | as faturas antigas continuam apontando para ele                                                                                                                        |

**Duas chaves de deduplicação**, que são o que faz a etapa 4 funcionar:

    farm_cards      (organization_id, emissor, ultimos_digitos)
    farm_receipts   (card_id, competencia) onde doc_type = 'fatura'

A primeira impede o mesmo cartão de ser cadastrado duas vezes e é como a foto de
uma fatura vai reconhecer de qual cartão ela é. A segunda impede a mesma fatura
de entrar duas vezes por caminhos diferentes — foto no WhatsApp e cadastro à mão.

`competencia` é DATA (dia 1 do mês) e não texto: assim ordena, compara e aceita
intervalo sem conversão.

### Rotas

    GET    /cards       POST /cards
    PATCH  /cards/:id   DELETE /cards/:id

Todas com o cliente DO USUÁRIO, nunca `service_role`: quem decide quem vê e quem
opera é a RLS. Repetir a regra no handler daria duas fontes para divergir.

Duas recusas deliberadas: cartão **com lançamento** não se apaga (409
`cartao_em_uso`) — desativar preserva o vínculo do histórico; e editar cartão de
outra pessoa devolve **404**, não 403, porque dizer "existe mas não é seu"
conta a quem não pode ver que ele existe.

## 6c. A aba Cartões (etapa 3)

`/faturas` virou `/cartoes`, e a lista virou HUB no molde de Configurações:
**Meus Cartões** e **Faturas**.

Três decisões tomadas ao desenhar:

**O hub aparece mesmo com um cartão só.** A alternativa — ir direto na lista com
um cartão, no hub com dois — são dois caminhos para manter por um clique de
economia num caso que dura pouco.

**Fatura sem cartão vinculado não bloqueia.** Ela aparece como está; bloquear
deixaria penduradas as faturas que já existem e impediria lançar fatura antes de
cadastrar o cartão.

**Fatura continua aparecendo em Lançamentos.** Agora ela É o gasto; tirá-la de lá
esconderia dinheiro que saiu. A aba Cartões é a visão POR CARTÃO, não um
esconderijo.

O caminho antigo `/faturas` redireciona **preservando a query**. Isso não é
zelo: o botão "Gerenciar itens" navega para `/faturas?open=<id>`, e um
`<Navigate>` simples descarta a busca — o link continuaria "funcionando" e
abriria a tela errada, que é o tipo de quebra que ninguém reporta.

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

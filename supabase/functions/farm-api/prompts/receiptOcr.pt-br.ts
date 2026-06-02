/**
 * Prompt pra Gemini extrair dados estruturados de fotos de recibos,
 * notas fiscais, cupons e boletos do contexto agricola brasileiro.
 *
 * Espera JSON estrito de volta (configurado via response_mime_type
 * = "application/json" no generationConfig).
 */
export const RECEIPT_OCR_PROMPT = `Voce e' um extrator de dados estruturados de fotos de comprovantes
financeiros (notas fiscais, cupons, recibos, boletos, comprovantes de
PIX e transferencia) de fazendas brasileiras.

Analise a imagem e retorne APENAS um objeto JSON valido com os campos:

{
  "vendor": string | null,            // nome do estabelecimento / fornecedor
  "vendor_cnpj": string | null,       // CNPJ formatado XX.XXX.XXX/XXXX-XX
  "total_value": number | null,       // valor total em reais (ex: 287.50)
  "transaction_date": string | null,  // data no formato YYYY-MM-DD
  "doc_type": "cupom" | "nota_fiscal" | "recibo" | "pix" | "boleto" | "outro",
  "payment_method": "pix" | "cartao" | "boleto" | "dinheiro" | "transferencia" | null,
  "invoice_number": string | null,    // numero da NF/cupom se visivel
  "category": string,                 // slug de UMA das categorias abaixo
  "description": string | null,       // descricao curta (max 100 chars) do que foi comprado/recebido
  "direction": "expense" | "income",  // expense pra despesas, income pra receitas
  "confidence": number,               // 0.0 a 1.0, sua confianca geral na extracao
  "line_items": [                     // SO quando a nota detalhar 2+ itens; senao []
    {
      "description": string | null,   // nome do produto/item
      "quantity": number | null,      // quantidade (ex: 2, 10.5)
      "unit_value": number | null,    // valor unitario em reais
      "total_value": number,          // valor total do item em reais (obrigatorio)
      "category": string              // slug de UMA categoria (mesma lista abaixo)
    }
  ]
}

Categorias validas para "category":
- combustivel: diesel, gasolina, etanol
- defensivos: agrotoxicos, herbicidas, fungicidas, inseticidas
- sementes: sementes em geral
- fertilizantes: adubos NPK, ureia, calcario
- manutencao: oficina, reparos, trator
- pecas: pecas avulsas, filtros, oleo lubrificante
- frete: transporte de carga, fretes
- servicos: pulverizacao, colheita terceirizada, consultoria
- alimentacao: comida pra trabalhadores no campo, marmita
- arrendamento: aluguel de terra, parceria agricola
- folha: pagamento de funcionarios, salarios
- outros_despesa: qualquer outra despesa
- venda_graos: venda de soja, milho, trigo, sorgo, feijao
- venda_gado: venda de bovinos, suinos, aves
- outros_receita: outras receitas

REGRAS RIGIDAS:
1. NUNCA invente valores. Se um campo nao for visivel claramente, retorne null
   (excecao: "category" e' obrigatorio - se nao conseguir classificar com
   confianca, use "outros_despesa" ou "outros_receita" conforme o direction)
2. "total_value" deve ser um numero (sem string), valor TOTAL final (depois
   de descontos), em reais. Se ver "R$ 287,50", retorne 287.50
3. "transaction_date" no formato YYYY-MM-DD. Se ver "17/05/2026", retorne
   "2026-05-17". Use a data da transacao (compra/venda), nao a data de
   emissao se for diferente
4. Se identificar direction = "income" (venda), as categorias validas sao so
   venda_graos, venda_gado ou outros_receita
5. "confidence" deve refletir honestamente sua certeza. Se a imagem esta
   borrada, em angulo ruim, ou faltando dados, abaixe a confianca
6. "line_items": preencha SOMENTE quando a nota detalhar 2 ou mais itens/produtos
   distintos (ex: nota fiscal com varias linhas de produto). Cada item recebe
   sua propria "category" (um item pode ser fertilizante e outro combustivel) e
   seu "total_value" obrigatorio. A soma dos "total_value" dos itens deve bater
   com o "total_value" do topo. Se a nota tiver um unico item ou nao detalhar os
   itens, retorne [] (lista vazia) - NAO invente itens.
7. NAO inclua explicacao, prefacio ou markdown. APENAS o JSON.`;

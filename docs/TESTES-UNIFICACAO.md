# Testes da unificação (Flag Field → gerentia)

> Bateria de testes manuais **pendente**. Decisão de 16/11/2026: construir as fases
> primeiro e testar tudo no fim, de uma vez. Cada fase acrescenta a sua seção.
> Plano geral: [UNIFICACAO-FIELD.md](UNIFICACAO-FIELD.md).

**Como testar:**
- `npm run dev` na branch `feat/unificacao-field` → http://localhost:3000.
- O app local usa o banco e o servidor de **produção**.
- Enquanto `FIELD_LIBERADO = false` (`src/lib/modulos.ts`), só o master vê o Field.

**Sem talhões para testar?** A fase 9 migra os dados do Flag Field
(`leonardo.terra@outlook.com`: 3 fazendas, 2 talhões, 8 plantios, 12 atividades). Dá para
antecipar essa migração só para ter massa de teste.

---

## Fase 0 — módulos e modo de uso (testada em 16/11/2026)

- [x] Seletor de módulo no topo do trilho (Finanças | Field), só para o master.
- [x] Página do Field abre; a volta para Finanças restaura o trilho.
- [x] Conta → Perfil → "Como você vai usar o Field?" salva.
- [ ] Painel do master (Configurações → Usuários → editar): campo "Modo de Uso (Field)" salva.
- [ ] Usuário comum (não master): trilho idêntico ao de antes, sem seletor.
- [ ] Celular: a gaveta do menu mostra uma seção por módulo.

## Fase 1 — cadastros (produtores, fazendas, talhões)

**Modo de uso:**
- [ ] Modo "Atendo vários produtores": aparecem Talhões, Fazendas e Produtores.
- [ ] Modo "Cuido da minha fazenda": Produtores some do menu e do formulário da fazenda.

**Produtores:**
- [ ] Cadastrar.
- [ ] CPF/CNPJ inválido é barrado.
- [ ] Nome repetido com outra acentuação ou caixa ("São João" × "SAO JOAO") é barrado.

**Fazendas:**
- [ ] A fazenda criada no cadastro da conta aparece e pode ser renomeada.
- [ ] Estado → cidade (lista do IBGE).
- [ ] Sede no mapa: toque, busca por cidade, busca por coordenada, GPS, botão de tirar.
- [ ] Excluir mostra a cascata (talhões + lançamentos que perdem o vínculo).

**Talhões — editor de mapa:**
- [ ] Polígono: marcar cantos e fechar tocando no 1º ponto.
- [ ] Arrastar vértice; arrastar o ponto do meio da aresta cria vértice.
- [ ] Tocar no vértice → "Remover vértice"; não deixa ficar com menos de 3.
- [ ] Desfazer, inclusive depois de fechar o polígono (reabre).
- [ ] Pivô: centro e borda → círculo de 36 vértices, área ≈ π·r².
- [ ] Marcador: ponto único; a área passa a ser digitada no formulário.
- [ ] Importar KML, KMZ e GeoJSON.
- [ ] Contorno que se cruza ("gravata") é recusado ao aplicar.
- [ ] Os outros talhões da fazenda aparecem em branco, com o nome.
- [ ] Alternar satélite ↔ mapa; busca; GPS; botão "Ir para a sede".

**Talhões — formulário e lista:**
- [ ] A área vem do desenho; sem desenho, área digitada obrigatória.
- [ ] Nome repetido na mesma fazenda é barrado (em outra fazenda, pode).
- [ ] A lista mostra a miniatura, a faixa azul/âmbar (irrigado/sequeiro), os filtros por produtor
      e fazenda, e a soma de hectares no contador.

**Lançamento ligado ao Field:**
- [ ] Os campos Fazenda e Talhão aparecem no formulário (só com o Field visível); o talhão é
      filtrado pela fazenda.
- [ ] Salvar e reabrir mantém o vínculo; trocar de fazenda limpa o talhão.

**Permissões** (precisa de uma org com equipe):
- [ ] Usuário (member) vê só o que ele cadastrou.
- [ ] Convidado vê tudo e não edita.
- [ ] Gestor vê tudo e edita só o que ele cadastrou.

**Celular** (largura estreita):
- [ ] Editor de mapa usável: botões alcançáveis, toque fecha o polígono.
- [ ] Listas e formulários usáveis.

**Backup:**
- [ ] Gerar um backup e conferir que produtores e talhões entram na contagem.

## Fase 2 — safra (safras, catálogo, plantios, atividades, custo por talhão)

**Safras:**
- [ ] Nova safra já vem sugerida com o ano agrícola (01/07 a 30/06); dá para mudar.
- [ ] Fim antes do início é barrado; nome repetido é barrado.
- [ ] Excluir avisa quantos plantios ficam sem safra.

**Catálogo:**
- [ ] Categoria Sementes mostra cultura, genética, grupo de maturação, ciclo e tipo de ciclo.
- [ ] As outras categorias mostram ingrediente ativo.
- [ ] Busca por nome, ingrediente ou fabricante; filtro por categoria.

**Plantios:**
- [ ] O talhão mostra "X ha livres de Y", descontando os plantios em andamento.
- [ ] A safra vem pré-escolhida pela vigente.
- [ ] A variedade sugere as já usadas na mesma cultura.
- [ ] Campo de semente mostra as categorias e a homologação.
- [ ] Área parcial exige os hectares.
- [ ] Concluir e Reativar pelo menu ⋯.

**Atividades:**
- [ ] Cada tipo mostra a sua seção (aplicação, adubação, calagem, gessagem, irrigação, colheita,
      plantio, observação, anotação, amostragem, chuva, clima, visita).
- [ ] Chuva, clima e visita: talhão opcional ("Fazenda toda") e sem plantio.
- [ ] Escolher um talhão com um único plantio em andamento já sugere o plantio.
- [ ] Data futura sugere "Planejada"; "Marcar como realizada" no menu ⋯.
- [ ] Aplicação: produto do catálogo (sugestão ao digitar) e produto livre → "Cadastrar no
      catálogo" abre o cadastro e, ao salvar, volta para a atividade com o produto preenchido.
- [ ] Custo: aplicação com 2 produtos (R$ 60 + R$ 40/ha) em 50 ha = R$ 5.000.
- [ ] Custo: calcário 2 t/ha × R$ 180/t × 30 ha = R$ 10.800.
- [ ] Custo: irrigação 20 mm × R$ 3/mm × 10 ha = R$ 600.
- [ ] Área parcial muda o custo; colheita mostra a produção estimada.
- [ ] Filtros por tipo, safra (atividade sem plantio cai na safra pela data), fazenda e situação.

**Custo por talhão:**
- [ ] Abre na safra vigente; "Período livre" pede as datas.
- [ ] Agronômico = atividades REALIZADAS do talhão na safra (as planejadas não contam).
- [ ] Realizado = despesas ligadas ao talhão na janela da safra.
      Entra a compra no cartão ligada ao talhão. Ficam fora a fatura, o previsto e o cancelado.
- [ ] Lançamento ligado só à fazenda aparece em "Só da fazenda" e não entra no R$/ha.
- [ ] Filtro por fazenda.
- [ ] Exportar CSV; "Imprimir / PDF" abre a página com o gráfico agronômico × realizado.

## Fase 3 — rotina (Pendências com agenda, Calendário, Field no Dashboard)

**Pendências:**
- [ ] Formulário com Hora, Tipo (Lembrete, Reunião, Visita, Deslocamento, Manutenção, Outro),
      Prioridade e Local.
- [ ] Com o Field visível: Fazenda e Talhão, com o talhão filtrado pela fazenda.
- [ ] Coluna Lembretes agrupada: Atrasados, Hoje, Próximos 7 dias, Depois, Sem data,
      Resolvidos. Os grupos só aparecem na ordem "vencimento".
- [ ] Pendência SEM valor tem o botão "Concluir"; COM valor continua resolvida pela conversão em
      lançamento.
- [ ] Cartão de compromisso (reunião, visita...) sem valor não mostra "R$ 0,00 / Sem centro";
      mostra o tipo, o local, onde e "às HH:MM".
- [ ] Prioridade alta mostra a bandeira vermelha.

**Calendário (`/calendario`, item fixo do trilho):**
- [ ] Mostra pendências com data e contas a pagar/receber em aberto (pagas não aparecem).
- [ ] Com o Field: atividades (planejada atrasada em vermelho) e plantio/colheita prevista.
- [ ] Visão Mês (até 3 por dia + "+N mais") e Lista; no celular, sempre lista.
- [ ] ‹ Hoje ›; a legenda liga e desliga categorias; filtro por fazenda.
- [ ] Clicar num item → detalhe → "Abrir" leva ao item: pendência abre o formulário; conta abre o
      lançamento; atividade e plantio abrem em leitura.
- [ ] Usuário sem o Field: o calendário só mostra pendências e contas (nada do campo).

**Dashboard:**
- [ ] Com o Field e talhões cadastrados: bloco "Campo" com plantios em andamento, atividades
      planejadas (e atrasadas), colheitas previstas e o custo da safra vigente.
- [ ] Os números e as listas levam às telas certas.
- [ ] Sem talhões, ou sem o Field, o bloco não aparece.

## Fase 4 — ensaios e análises (desenvolvimento de mercado)

**Lista de Ensaios:**
- [ ] Cartão com a cor do tipo, onde fica, "Principal: X · Concorrente: Y", quantidade de
      avaliações e o selo Conduzindo / Colhido / Concluído.
- [ ] Filtro por fazenda pega também ensaio SEM talhão (bug do Flag Field corrigido).
- [ ] Concluir e Reativar pelo menu ⋯; excluir mostra a cascata (produtos, avaliações, colheitas).

**Configuração:**
- [ ] Fazenda, cultura e nome obrigatórios; talhão, plantio e safra opcionais.
- [ ] Escolher um plantio já sugere a cultura e a safra dele.
- [ ] Criar o ensaio libera as outras abas e pula para Produtos.

**Produtos:**
- [ ] A busca no catálogo mostra só as categorias do tipo (sementes: só da mesma cultura).
- [ ] "+ Principal" / "+ Concorrente"; "Cadastrar no catálogo" sem sair do ensaio.
- [ ] Editar: papel, dose e unidade (ou população em sementes), custo R$/ha. Sem dose (ou sem
      população), aparece o selo "Preencher".
- [ ] Remover produto avisa quantas avaliações e colheitas vão junto.

**Avaliações:**
- [ ] Nova etapa: tipo, estádio e características. A sugestão preenche unidade e escala.
- [ ] Grade produto × etapa com "X de Y preenchidas"; a avaliação completa fica verde.
- [ ] Qualitativa com escala: escolhe da lista (nota 1–9, 1–5, presente/ausente...).
- [ ] Excluir a etapa avisa quantas avaliações vão junto.
- [ ] Avaliação sem etapa aparece em "Avaliações avulsas" (para testar, precisa vir do bot na
      fase 7 ou de um insert direto).

**Colheita:**
- [ ] Manual (sc/ha) ou calculada (3.000 kg em 0,5 ha = 100 sc/ha).
- [ ] 60 sc/ha a 18% corrigida para 13% = 56,55. A prévia e o salvo mostram o MESMO número.
- [ ] Uma colheita por produto: o produto já colhido sai da lista.

**ROI:**
- [ ] Preço da saca e custo por produto salvam ao sair do campo.
- [ ] Referência automática = 1º principal com colheita; dá para escolher outra.
- [ ] Referência 62 sc, testado 68 sc, custo R$ 260, saca R$ 120: ganho R$ 720, lucro R$ 460,
      ROI 176,9%.
- [ ] CSV e Imprimir / PDF.

**Análises (`/campo/analises`):**
- [ ] O ranking junta o mesmo produto do catálogo entre ensaios (média, mín.–máx., nº de
      ensaios).
- [ ] Ganho por ensaio com o selo de quem venceu; resumo com ganho médio, vitórias e empates.
- [ ] Filtros (fazenda, cultura, safra, tipo, situação); CSV e imprimir.

**Integrações:**
- [ ] Plantio com finalidade "Campo demonstrativo (GD)" ou "GD comercial": o menu ⋯ tem "Criar
      ensaio neste plantio", que abre o ensaio já com talhão, plantio, cultura e safra.
- [ ] Calendário: categoria "Ensaios" com a implantação e os dias de avaliação; "Abrir" leva ao
      ensaio.

## Fase 5 — NDVI, clima, GDD e anexos

**NDVI (`/campo/ndvi`, ou "Ver NDVI" no menu ⋯ do talhão):**
- [ ] Só aparecem talhões com contorno; sem nenhum, o aviso manda desenhar.
- [ ] "Buscar imagens" lista as datas com a % do TALHÃO sem nuvem (as menos de 30% somem).
- [ ] Cor real e os índices NDVI, NDRE, NDMI, SAVI, GNDVI, EVI e PSRI como camada sobre o
      satélite, no lugar certo e sem esticar.
- [ ] A legenda bate com as cores da imagem; o PSRI tem a paleta invertida.
- [ ] Estatísticas: média, mediana, mín., máx. e % sem nuvem. Lavoura fechada dá NDVI perto de
      0,8 (o desconto de +1000 do Sentinel-2).
- [ ] Contador "X de 120 imagens este mês". Voltar a uma imagem já vista não gasta de novo.
- [ ] "Comparar duas datas" lado a lado.
- [ ] Ao bater 120 imagens, a 121ª dá a mensagem do teto (o teto do Flag Field nunca bloqueava).

**Clima (`/campo/clima`):**
- [ ] Usa a sede da fazenda, ou o meio do 1º talhão desenhado; "Onde estou" usa o GPS.
- [ ] Vento em km/h realista (o Flag Field mostrava 3,6× maior).
- [ ] Janela de aplicação: até 3 horas, com a nota e os motivos (vento, calmaria, umidade, calor,
      horário); chuva na hora ou nas 2 seguintes exclui a hora.
- [ ] Previsão de 7 dias (máx./mín., chuva % e mm, vento, UV).
- [ ] Dashboard: o bloco "Campo" mostra o clima de agora e a melhor janela.

**GDD:**
- [ ] Plantio salvo, aberto em leitura: "Graus-dia desde o plantio: X (temperatura-base Y °C)",
      com a base da cultura (soja 10, algodão 15, trigo 5...).

**Fotos e arquivos:**
- [ ] Atividade: "Adicionar foto ou PDF" (no celular abre a câmera); a miniatura aparece; tocar
      abre; o "x" tira do registro; até 10.
- [ ] A lista de atividades mostra o clipe com a quantidade.
- [ ] Avaliação de ensaio: as mesmas fotos e arquivos.
- [ ] Usuário de outra organização não abre a foto (link restrito à pasta da org).

## Fase 6 — relatórios (plantio, ensaio, painel da safra)

Testar na **web** (abre a página de imprimir) e no **celular** (gera PDF e abre o compartilhar).

**Relatório do plantio (menu ⋯ do cartão → "Relatório", ou os botões no topo do plantio aberto):**
- [ ] Cartões: área, custo agronômico, R$/ha e produtividade (ou graus-dia, sem colheita).
- [ ] "Dados do plantio": produtor, fazenda, talhão, safra, cultura, finalidade, datas, área,
      população, semente, graus-dia e observações (texto longo quebra em linhas no PDF).
- [ ] "Atividades": todas as do plantio, por data, com produtos e dose; o total soma só as
      realizadas (as planejadas aparecem em "Dados do plantio" como "Planejado (a fazer)").
- [ ] "Custo agronômico por tipo" com a rosca; R$/ha pela área do plantio (a parcial, se for).
- [ ] "Lançamentos do financeiro no talhão": os do talhão na janela da safra (sem safra, do plantio
      até a colheita), à parte do agronômico; fatura e previsto ficam fora.
- [ ] "Relatório com fotos (N)" só aparece com foto ou PDF nas atividades; as fotos vão no fim,
      cada uma com a legenda "data · tipo · arquivo".
- [ ] CSV abre no Excel com as mesmas tabelas.

**Relatório do ensaio (menu ⋯ do cartão, ou os botões no topo do ensaio aberto):**
- [ ] "Dados do ensaio" e "Produtos" (dose, população, custo/ha).
- [ ] Uma tabela por etapa de avaliação (produto × características); produto sem avaliação
      aparece com "—"; as avulsas (WhatsApp) numa tabela à parte.
- [ ] "Colheita" com as barras por produto; a produtividade é a mesma da aba Colheita.
- [ ] "ROI" igual ao da aba ROI (mesma conta; o botão da aba ROI continua gerando só o ROI).
- [ ] Com fotos: legenda "etapa · data · produto · arquivo".

**Painel da safra (`/campo/painel`, primeiro item do Field no trilho):**
- [ ] Abre na safra vigente; troca safra e fazenda.
- [ ] Cartões: área plantada, plantios, atividades atrasadas (planejadas com data passada),
      colheitas previstas nos próximos 15 dias.
- [ ] Área por cultura (rosca) e por finalidade; produtividade colhida por cultura (média
      ponderada pela área, sc/ha separado de t/ha); custo agronômico por tipo (barras).
- [ ] Tabela dos plantios com situação e atividades feitas/total (e atrasadas).
- [ ] Plantio sem safra marcada entra pela data de plantio dentro da janela da safra.
- [ ] CSV e Relatório; o link leva a Custo por Talhão.

**Sem regressão no financeiro:**
- [ ] Relatórios → "com anexos" continua juntando as notas no PDF (web e celular).
- [ ] Notas → selecionar várias → Imprimir continua juntando os anexos.
- [ ] Um lançamento com emoji na descrição não derruba mais o PDF do celular.

## Ajustes visuais — marca, entrada e tema escuro (17/11/2026)

**Marca e entrada:**
- [ ] Logo (óculos) e nome "gerentia.app" desenhado em `#3C3C42` na entrada, no menu e no
      cabeçalho do celular.
- [ ] Entrada (abrir numa janela anônima para ver a abertura): brilho na armação, mexidinha
      do bigode e o nome digitado com cursor. F5 em seguida não repete; com a tela aberta, o
      brilho volta a cada ~20 s. Com "reduzir movimento" no sistema, nada anda.
- [ ] Card limão da Cropware (relevo do site) leva a cropware.com.br; no app instalado abre
      fora do app.
- [ ] Rodapé: Termos de Uso, Política de Privacidade, Ajuda — os três abrem.
- [ ] Criar conta: frase de aceite com os dois links acima do botão.

**Cores da marca:**
- [ ] Botão principal (Novo Lançamento, Salvar, Entrar) em `#3C3C42`; cinzas do app com o
      leve tom frio do grafite (menu, bordas, textos de apoio).
- [ ] Menu lateral com ícone + nome; seletor de módulo e conta com nome; topo com o nome e o módulo ativo ("gerentia.app/field", "/finanças" em cinza), trocando junto com o seletor; ícones cheios, numa cor só (grafite), legíveis no claro e no escuro.

**Tema escuro (Conta → Aparência; atalho no menu da conta e na gaveta do celular):**
- [ ] Claro / Escuro / Igual ao Sistema; a escolha vale para o aparelho e sobrevive ao F5,
      sem piscar branco ao abrir.
- [ ] "Igual ao Sistema" troca sozinho quando o sistema troca.
- [ ] Passar pelas telas no escuro: Dashboard (gráfico e tooltip), Lançamentos, Notas,
      Cartões, Recorrências, Relatórios, Calendário, Pendências, Configurações, e no Field:
      Painel da Safra (gráficos), Talhões/mapa, NDVI, Plantios, Atividades, Ensaios.
      Procurar texto que some no fundo, caixa clara sobrando, selo ilegível.
- [ ] Menus de ação, filtros e dicas continuam no vidro escuro; diálogos de confirmação
      legíveis.
- [ ] Avisos (toast) no tema do app; barra de status do celular escura com ícones claros.
- [ ] Relatórios/PDF continuam claros (são para imprimir).

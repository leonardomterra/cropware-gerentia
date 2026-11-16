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

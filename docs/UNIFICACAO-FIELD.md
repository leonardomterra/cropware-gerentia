# Unificação: o Flag Field entra no gerentia

> Criado em 16/11/2026. Status: **proposta em discussão**. Nada daqui foi implementado.
> O que é decisão do Leonardo está marcado como **decidido**; o resto é proposta.

## 1. O que foi decidido

- O gerentia passa a ser **o** app: Flag Field + gerentia num produto só, com módulos.
  A princípio: **Finanças** (o gerentia de hoje) e **Field/DM** (o Flag Field).
- Públicos: **consultores, agrônomos e produtores rurais** (e derivados: revendas, ATs, DMs,
  gerentes e ADMs de fazenda). Cada um adapta o uso, como no Farmbox e no Aegro.
- Tom: **gestão de talhões da fazenda**, sem perder o uso de desenvolvimento de mercado
  (campos demonstrativos, ensaios).
- IA robusta como parte central: o usuário consegue gerir e consultar pela IA.
- Coreflow e equipamentos são **outro produto**, fora deste escopo.
- Preço: cada módulo mantém a tabela atual do seu app; o detalhe fica para depois.
- Ritmo: por etapas, cada uma publicável sozinha.

## 2. Ponto de partida

**Usuários do Flag Field (16/11/2026):** 9 contas, nenhuma assinatura ativa. Só as contas do
Leonardo e a de revisão da Apple têm dados. Quatro externos se cadastraram e saíram sem criar
nada (provável efeito do paywall sem teste grátis). **Não há base de clientes a preservar**:
o modelo novo não precisa ser compatível com o do Flag Field.

**gerentia, o que pesa no desenho:**
- `farms` existe (org → fazendas, `area_ha`), mas é de fachada: tela fora do menu, `GET/POST
  /farms` responde 501, `farm_receipts.farm_id` sempre nulo, RLS antiga (até o `viewer` escreve).
- O eixo do financeiro é o **centro de custo** (máx. 6 por org, sem área, sem ligação com fazenda).
- A cobrança é **uma assinatura por org**, e o `PaywallGate` trava o app inteiro, só no front.
  O servidor e o bot não conferem plano.
- O trilho do menu não tem grupos.
- Não tem biblioteca de mapa nem modo offline.
- Os docs antigos (blueprint, FARM-FISCAL-VIABILITY) mandavam **não** trazer talhão nem NDVI e
  fazer custo/ha com hectares no CC. **Esta decisão supera isso.**

**Flag Field, o que pesa:**
- O CRUD vai direto no Postgres via supabase-js + RLS (`created_by = auth.uid()`). Um hook
  carrega tudo na abertura. A função de servidor fica com NDVI, upload, bot e cobrança.
- Geometria do talhão em `coordinates jsonb` como `[[lat,lng],…]`: não é GeoJSON nem PostGIS,
  e a ordem é invertida.
- Ensaio não tem tabela própria: é uma linha de `plantings` com `ensaio_mode` + `trial_data jsonb`.
- Custo: `activities.cost` = total em R$ (Σ R$/ha dos insumos × área). Custos e R$/ha são
  calculados na tela.
- Duas pilhas de mapa: Google Maps na visualização e Leaflet no desenho, nos pickers e no GPS.
- Offline-first de verdade: service worker + fila no IndexedDB. Não tem fila para anexos.
- Bot: ~30 ferramentas (só criar e consultar), OpenAI `gpt-5.4-mini` + Whisper + Gemini (foto)
  + Tavily (web). Cadastros guiados em `fluxos.tsx`.
- Arquivos gigantes (ActivityManagement 3.590 linhas, TrialManager 3.638, MapDrawingToolAdvanced
  2.360), herança do CDM.

## 3. Princípio do porte

**Levar as funcionalidades, não o código.** Banco, servidor e bot são reescritos no padrão do
gerentia (org + papéis + RLS com helpers). Telas e componentes do Flag Field são reaproveitados
(a stack é a mesma), mas quebrados em pedaços menores e livres do legado do CDM. Só os ícones
precisam adaptação: `@phosphor-icons/react` vira `~icons/ph/…`.

## 4. Modelo de dados proposto

```
organizations (já existe; individual | company)
 └─ farm_producers   (NOVO, opcional: o consultor tem vários; o produtor não precisa ver)
 └─ farms            (já existe; ganha producer_id, lat/lng, IE, link do mapa)
     └─ farm_plots   (NOVO, talhões: área, solo, irrigação, geometria GeoJSON)
         └─ farm_plantings (NOVO, plantio = talhão × safra × cultura; finalidade comercial |
                            demonstrativo | ensaio)
             └─ farm_activities (NOVO: tipo, data, insumos jsonb, observações, custo, colheita,
                                 chuva, anexos, marcadores no mapa)
 └─ farm_trials      (NOVO: tabela própria em vez de ensaio_mode + trial_data em plantings)
 └─ farm_products    (NOVO: catálogo de insumos)
 └─ farm_tasks       (já existe, a Pendências; absorve a Agenda do Flag Field)
 └─ farm_receipts    (já existe; farm_id passa a ser usado, mais plot_id/planting_id opcionais)
```

Regras:
- **Prefixo `farm_`** e o padrão de RLS do gerentia: lê org + (`farm_can_read_all()` ou
  `created_by = auth.uid()`), e escreve com `farm_can_write()`. Corrigir a RLS de `farms` junto.
- **Geometria em GeoJSON** (`[lng,lat]`, padrão), em jsonb. PostGIS só se surgir necessidade
  (por exemplo, consulta espacial no servidor).
- **UUID gerado no cliente** e upsert idempotente desde o início, para o offline caber depois
  sem refazer nada.
- **Produtor opcional.** `farms.producer_id` pode ser nulo. Quem usa como produtor nem vê o nível
  "Produtores"; quem usa como consultor, vê. A escolha sai do tipo de uso (`users_meta.activity_area`
  já existe), definido no cadastro e editável pelo próprio usuário ou pelo master.

## 5. Onde finanças e campo se encontram (a razão de juntar)

- **Lançamento ligado à fazenda/talhão/plantio.** Opcional, no mesmo formulário (e no
  WhatsApp: "foi pro talhão 3").
- **Dois custos, lado a lado, sem fingir que são o mesmo:**
  - *custo agronômico*: o que a atividade diz (insumo × dose × área), uma estimativa;
  - *custo realizado*: o que foi lançado e pago no financeiro.
  O relatório do talhão/safra mostra os dois e o R$/ha de cada um. "Gerar lançamento a partir da
  atividade" fica para uma etapa posterior.
- **Calendário único:** plantios, colheitas, atividades, pendências e vencimentos financeiros.
- **Centro de custo continua** dizendo *de quem* é o gasto (casa, empresa, fazenda). Talhão e
  plantio são a dimensão agronômica. O "hectares no CC" dos docs antigos sai de cena.

## 6. Funcionalidade por funcionalidade

| Flag Field | Destino no gerentia | Nota |
|---|---|---|
| Produtores, Fazendas | **Entra** | Produtor opcional (ver §4). Importação CSV vem junto |
| Talhões + desenho no mapa | **Entra** | Leaflet; polígono, pivô, marcador, KML/KMZ/GeoJSON |
| Catálogo | **Entra** | |
| Plantios | **Entra, ajustado** | Status herdados do CDM (`seed_field`, `gd_field`…) viram o campo *finalidade* |
| Atividades (Histórico) | **Entra, reescrito** | O form de 3,6 mil linhas vira um form por tipo de atividade |
| Custos | **Muda** | Vira o relatório "custo por talhão/safra" (agronômico + realizado) |
| Relatórios PDF/Excel | **Entra** | Relatório de plantio; PDF nativo no iOS já existe |
| Ensaios + Análises | **Entra** | Tabela própria; é o coração do uso de DM |
| Painel de Plantios (gráficos, GDD) | **Entra depois** | Junto dos relatórios |
| Visualização (mapa) | **Muda** | Uma pilha de mapa só (Leaflet); sai o Google Maps |
| NDVI | **Entra** | Planetary Computer; limite de 120/mês no servidor |
| Clima | **Entra** | Open-Meteo, sem chave |
| Agenda | **Muda** | Funde com a Pendências (`farm_tasks` ganha hora, tipo, vínculo a talhão) |
| Calendário | **Muda** | Único, incluindo vencimentos financeiros |
| Dashboard | **Muda** | Um painel só, com blocos por módulo |
| Distância GPS | **Entra** (decidido 16/11) | Ferramenta avulsa; hoje não salva a trilha |
| Backup, Perfil, Assinatura | **Já existe no gerentia** | Assinatura passa a ser por módulo |
| Master: usuários, planos, saúde da IA | **Já existe/adaptar** | Leads fica fora |
| Offline-first | **Entra depois, mas planejado agora** | Ver §8 |
| Bot do WhatsApp | **Funde** | Um número só (o do gerentia), ferramentas por módulo |

## 7. Módulos e cobrança (estrutura, não preço)

- Tabela de direitos por org e módulo (por exemplo `organization_entitlements(org, module, source,
  expires_at)`), alimentada por Mercado Pago, RevenueCat e cortesia.
- `/auth/me` devolve os módulos liberados. O menu mostra cada módulo conforme o direito (ou com
  convite para assinar).
- O `PaywallGate` global vira um gate por módulo. **Trava no servidor** (`requireModule`) nos
  handlers e nas ferramentas do bot. Hoje o gerentia não trava nada no servidor.
- Trial: definir por módulo. **Lição do Flag Field:** paywall direto no cadastro afastou os 4
  interessados.

## 8. Offline

O uso no talhão pede offline, e o gerentia não tem. Proposta: o módulo Field faz CRUD **direto via
supabase-js + RLS** (como o Flag Field), porque a fila offline reenvia upserts. O servidor fica com
NDVI, upload, bot e cobrança. Com UUID no cliente e upsert idempotente desde a fase 1, o offline
entra numa fase própria sem refazer as telas.

## 9. Fases propostas

Cada fase vai ao ar sozinha.

0. **Fundação.** Direitos por módulo + gate no servidor; menu com grupos; tipo de uso (produtor ou
   consultor); RLS de `farms`; Leaflet.
1. **Cadastros.** Produtores, fazendas, talhões com mapa. Lançamento ligado à fazenda/talhão.
2. **Safra.** Catálogo, plantios, atividades com custo. **Primeiro relatório de custo por
   talhão/safra** (o valor do produto unificado aparece aqui).
3. **Rotina.** Pendências + Agenda fundidas, calendário único, dashboard por módulo.
4. **DM.** Ensaios e análises.
5. **Satélite e clima.** NDVI, clima, GDD.
6. **Relatórios.** PDF do plantio/talhão, Excel, painel.
7. **IA.** Ferramentas do Field no bot (criar e consultar), guiadas como no `fluxos.tsx`.
8. **Offline.**
9. **Virada.** Migrar os dados do Leonardo e recriar a conta de revisão da Apple; redirecionar
   flagfield.cropware.com.br; tirar o Flag Field das lojas; reaproveitar os 4 cadastros como contatos.

## 9b. Andamento

- **Fase 0 (16/11/2026): concluída.** Banco (2 migrations) e servidor publicados a partir da
  branch; a web só vai ao ar no merge da unificação na `main`.
  - De quebra: corrigida a regra de acesso que impedia **todo usuário** de salvar o próprio
    Perfil desde 21/06 (recursão na policy do `users_meta`,
    `20261117130000_users_meta_policy_sem_recursao.sql`).
  - Migration `20261117120000_modulos_e_modo_de_uso.sql`.
  - `/auth/me` e `/billing/subscription` devolvem `modules`.
  - `lib/modulos.ts` com a chave `FIELD_LIBERADO`.
  - Seletor de módulo no trilho; `ModuloGate`; página provisória `/campo`, só para o master.
  - Modo de uso na Conta e no painel do master.
  - A pergunta do modo de uso no **cadastro** só aparece com `FIELD_LIBERADO = true`. Antes
    disso, quem assina só o Finanças (inclusive fora do agro) não tem por que responder
    sobre produtores.

- **Fase 1 (16/11/2026): no ar** (migration `20261118120000_field_cadastros.sql` + servidor,
  publicados a partir da branch).
  - Telas: produtores, fazendas (sede no mapa) e talhões (editor de mapa).
  - Vínculo do lançamento com fazenda/talhão.
  - Satélite da Esri, sem os tiles diretos do Google; miniaturas em SVG.
  - **Testes manuais pendentes**: em [TESTES-UNIFICACAO.md](TESTES-UNIFICACAO.md).

- **Fase 2 (16/11/2026): no ar** (migration `20261119120000_field_safra.sql` + servidor, a partir da
  branch; testes manuais pendentes).
  - Safras cadastradas e catálogo sem preço.
  - Plantios com finalidade (inclui campo demonstrativo/GD).
  - Atividades com custo agronômico; calagem e gessagem como tipos próprios, no lugar de
    "Corretivos".
  - **Custo por talhão** (agronômico × realizado, "só da fazenda" à parte).
  - **Regra do realizado:** conta a compra no cartão ligada ao talhão e deixa a fatura de fora
    (no financeiro é o contrário).
  - **Ficou para depois:** marcadores no mapa (observação/anotação/amostragem), fotos e anexos
    das atividades, painel de plantios com GDD, PDF do plantio, "Iniciar plantio" a partir do
    talhão.

- **Fase 3 (16/11/2026): no ar** (migration `20261120120000_pendencias_agenda.sql` + servidor, a partir
  da branch; testes manuais pendentes).
  - A Agenda do Flag Field virou campos da Pendência: hora, tipo, prioridade, local,
    fazenda/talhão.
  - Operação de campo planejada continua sendo Atividade.
  - Concluir rápido só para pendência sem valor.
  - Calendário único (financeiro + campo), como tela fixa; bloco "Campo" no Dashboard.
  - **Ficou para depois:** pendência com hora/tipo pelo WhatsApp (fase 7); notificação de
    atividade planejada pelo cron; visão semanal do calendário.

- **Fase 4 (16/11/2026): no ar** (migration `20261121120000_field_ensaios.sql` + servidor, a partir da
  branch; testes manuais pendentes).
  - Ensaios com tabelas próprias: produtos, etapas, avaliações, colheitas. Cada parte salva na
    hora.
  - **ROI com o custo total do produto** (decisão de 16/11), numa função só.
  - Correção de umidade igual na prévia e no salvar.
  - Avaliações avulsas visíveis.
  - Análises com ranking por produto do catálogo.
  - Atalho "Criar ensaio neste plantio"; ensaios no calendário.
  - **Ficou para depois:** fotos e anexos das avaliações, que entram junto com os das atividades;
    PDF completo do ensaio (fase 6); ferramentas de ensaio no WhatsApp (fase 7); Excel.

- **Fase 5 (16/11/2026): no ar** (migration `20261122120000_field_ndvi_anexos.sql` + servidor, a partir da
  branch; testes manuais pendentes).
  - **NDVI** e mais 7 vistas (cor real, NDRE, NDMI, SAVI, GNDVI, EVI, PSRI), pelo Planetary
    Computer via servidor:
    - teto de 120 imagens por mês por org, sem plano (decisão de 16/11);
    - imagem como camada no mapa.
  - **Clima** pelo Open-Meteo direto do navegador, com janela de aplicação; GDD por plantio.
  - **Fotos e PDFs** em atividades e avaliações (R2 privado).
  - **Corrigido do Flag Field:** o teto que nunca bloqueava, a imagem de outra data, o offset
    aplicado a toda cena, a legenda descasada, a estatística inventada, o vento ×3,6, a umidade
    faltando e o GDD médio entre culturas.
  - **Ficou para depois:** o visualizador com zoom e o valor no clique do NDVI; o relatório de
    NDVI; apagar no R2 o anexo removido; o clima e a janela de aplicação pelo WhatsApp (fase 7).

## 10. Em aberto

- **LEMBRAR O LEONARDO ao fim da unificação:** criar a chave do Microsoft Planetary Computer e
  gravar como segredo `PLANETARY_COMPUTER_KEY` na edge `gerentia-api`. É opcional: sem ela o NDVI
  funciona anônimo, e a chave só aumenta o limite de requisições.

- **Decidido (16/11):** produtor opcional, definido pelo tipo de uso. O tipo é escolhido no
  cadastro e pode ser trocado pelo próprio usuário ou pelo master.
- **Decidido (16/11):** offline vem numa fase depois (o banco nasce preparado).
- **Decidido (16/11):** Distância GPS entra.
- **Decidido (16/11):** custo agronômico (atividade) e custo realizado (lançamento) lado a lado,
  sem um gerar o outro. "Gerar lançamento desta atividade" pode vir depois como botão opcional.
- IA do bot: Gemini (gerentia) ou OpenAI (Flag Field). Pode ficar para a fase 7.
- Nome dos módulos e do Flag Field dentro do gerentia.
- O CDM (`idplesalbuitsyzlpoiy`) tinha dados reais em agosto (15 usuários, 61 talhões) e não está
  acessível pelo conector. Há alguém lá para trazer?

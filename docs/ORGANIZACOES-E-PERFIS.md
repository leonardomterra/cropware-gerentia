# Organizações e perfis de acesso

> Plano de implantação do modelo multiusuário (organização + 3 perfis).
> Criado em 19/08/2026. Gatilho: primeiro cliente corporativo pedindo equipe com dados compartilhados.

---

## 1. O problema

Hoje o Gerentia é **1 conta = 1 organização = 1 pessoa** (o "assinante avulso"). O código já tem
organização, papéis (`owner`/`admin`/`member`), convite por código de 6 dígitos e uma página **Equipe** —
mas o eixo de separação implementado é o **Centro de Custo**, não **quem lançou o registro**.

O cliente corporativo precisa do eixo oposto:

- cada pessoa da equipe vê e edita **só o que ela mesma lançou**;
- o gestor vê **tudo da organização**;
- um convidado (diretor, contador, auditor) vê tudo e **não mexe em nada**.

### Estado em produção (consultado em 19/08/2026)

| Métrica | Valor |
|---|---|
| Organizações | 10 |
| Usuários (`users_meta`) | 9 — **todos `owner`** |
| Orgs com 2+ usuários | **0** |
| Convites usados | 0 |
| Vínculos usuário↔centro de custo | 0 |
| Lançamentos | 87 |

A trilha multiusuário **nunca foi exercida em produção**. Isso permite redefinir a semântica de `member`
(de "por centro de custo" para "por propriedade do registro") **sem migrar dado de nenhum cliente** —
é a razão de este plano ser barato agora e caro depois.

---

## 2. Os perfis

| Perfil (UI) | `users_meta.role` | Enxerga | Cria / edita / apaga | Gerencia equipe |
|---|---|---|---|---|
| **Gestor (titular)** | `owner` | tudo da organização | **só o que ele lançou** | sim |
| **Gestor** | `admin` | tudo da organização | **só o que ele lançou** | sim |
| **Usuário** | `member` | só o que ele lançou | só o que ele lançou | não |
| **Convidado** | `viewer` *(novo)* | tudo da organização | **nada** | não |
| **Assinante** (avulso) | `owner` em org `individual` | tudo (que é só dele) | tudo | n/a |

Notas de produto:

- **O gestor também é um usuário**: ele lança as próprias despesas normalmente. "Ver tudo" e "editar o
  próprio" são independentes.
- **Gestor não edita o lançamento de terceiro** — decidido: por enquanto não. A regra está isolada em
  uma função SQL (`farm_can_write_others()`), então habilitar depois é trocar uma linha, não reescrever
  as policies.
- **Assinante avulso não muda nada.** Continua como hoje: `owner` de uma organização `individual`.
  A diferença entre "assinante" e "empresa" é `organizations.kind`, não o papel.

---

## 3. Decisões tomadas (19/08/2026)

1. **Cobrança:** contrato manual por enquanto. O Master define `seats_limit` na organização; o preço da
   equipe é negociado fora do app. Nenhum plano novo no Mercado Pago nesta rodada — mas o campo já fica
   no schema para a cobrança por assento entrar depois sem mexer em migração.
2. **Quem cadastra:** o **Master** cria a organização e o gestor; o **gestor** convida a própria equipe
   pelo código de 6 dígitos que já existe. Menos trabalho operacional e reaproveita fluxo pronto.
3. **Desvínculo de usuário:** os lançamentos **ficam na organização** (o dado é da empresa). O usuário sai
   com uma conta avulsa vazia. O histórico continua visível para o gestor como *"lançado por Fulano (removido)"*.
4. **Backups por usuário/org no Master:** última etapa, depois de tudo funcionando.

---

## 4. Modelo de dados

Mudanças mínimas — nada de tabela nova no núcleo.

```
organizations
  + kind          text  not null default 'individual'   -- individual | company
  + seats_limit   int                                    -- null = 1 (avulso)

users_meta
  ~ role          text  check (role in ('owner','admin','member','viewer'))   -- + viewer

farm_org_former_members   (nova, só na Etapa 4)
    organization_id, user_id, full_name, removed_at, removed_by
    -- guarda o nome de quem saiu, pra lista antiga não virar "lançado por (?)"
```

Funções auxiliares (todas `stable security definer set search_path=''`, no mesmo padrão do
`farm_current_org_id()` que já existe — evita recursão de RLS):

| Função | Devolve |
|---|---|
| `farm_current_role()` | papel do usuário atual |
| `farm_can_read_all()` | `true` para `owner`, `admin`, `viewer` |
| `farm_can_write()` | `true` para todos menos `viewer` |
| `farm_can_write_others()` | `false` hoje — o interruptor para "gestor edita tudo" |

`farm_user_cost_centers` **não é removida**: o centro de custo deixa de ser regra de visibilidade e volta
a ser o que sempre deveria ter sido — classificação. A tabela fica (0 linhas em produção) para uma
eventual restrição de escrita ("este usuário só lança no CC Fazenda X").

---

## 5. A regra de ouro (RLS)

Toda a separação vive no banco, **não na API**. Isso não é preferência de estilo: os handlers do
`gerentia-api` já consultam sem filtro de organização e confiam na RLS. Trocar a policy conserta o app
inteiro de uma vez — lista, dashboard, relatórios, anexos, exportação — e nada fica de fora por
esquecimento.

Para `farm_receipts`, `farm_receipt_items`, `farm_tasks`, `farm_recurring_receipts`:

```sql
-- leitura
using ( organization_id = farm_current_org_id()
        and ( farm_can_read_all() or created_by = auth.uid() ) )

-- escrita (insert/update/delete)
using / with check
      ( organization_id = farm_current_org_id()
        and farm_can_write()
        and ( created_by = auth.uid() or farm_can_write_others() ) )
```

Três correções embutidas nessa troca:

1. **`FOR ALL` vira policy por comando.** Hoje as tabelas usam uma policy `FOR ALL USING (...)` sem
   `WITH CHECK` — o Postgres reaproveita o `USING` como check, então qualquer membro da org pode inserir
   um registro **atribuído a outra pessoa** (`created_by` não é validado). Isso é um bug de integridade
   hoje e viraria um furo de segurança no modelo novo.
2. **`farm_receipt_items` herda o dono do lançamento pai** (via `EXISTS` no `farm_receipts`), em vez de
   ganhar um `created_by` próprio que poderia divergir do cabeçalho.
3. **`users_meta` deixa de ser legível por toda a org.** Hoje qualquer membro lê nome, telefone e **CPF**
   dos colegas. Passa a exigir `farm_can_read_all()` — quem precisa da lista é o gestor, na tela de Equipe.

---

## 6. Etapas

### Etapa 1 — Fundação no banco *(o coração)* — ✅ APLICADA em 19/08/2026
- `organizations.kind` + `seats_limit`; `viewer` no check de `role`.
- As 4 funções auxiliares.
- Reescrita das policies das 4 tabelas de dados + `users_meta`.
- Backfill de `farm_recurring_receipts.created_by` (hoje nullable) e `not null`.
- **Entrega:** os 4 perfis funcionando de verdade no banco, verificados pela matriz da §8.

### Etapa 2 — API alinhada — ✅ DEPLOYADA em 19/08/2026
- `requireFarmUser` passa a devolver `canReadAll`/`canWrite`; novo `requireCanWrite` (403 para convidado).
- `/auth/me` devolve `role`, `organization.kind` e um objeto `permissions` — a UI não recalcula regra.
- **WhatsApp/IA (`farmAi.ts`)**: hoje roda com `service_role` filtrando **só por organização** — no modelo
  novo, um membro perguntando "quanto gastei esse mês?" veria a empresa inteira. Entra um
  `applyVisibility(query, linked)` em todas as consultas, e convidado fica somente-leitura no bot.
- **Cron do resumo semanal**: hoje manda o total **da organização** para cada telefone vinculado. Passa a
  respeitar o perfil (membro recebe o dele; gestor recebe o consolidado).
- Convite passa a aceitar `viewer`; convite respeita `seats_limit`.

### Etapa 3 — UI da organização — ✅ PRONTA em 19/08/2026
- Página **Equipe** com os 3 perfis nomeados em português, contador de assentos e a explicação do que
  cada um enxerga.
- **Modo convidado**: `isViewer` consumido dentro dos componentes (não por prop, que se esquece de
  passar); faixa de aviso no topo; botão de criar/editar/apagar some em vez de dar erro ao clicar.
- **Visão do gestor**: alternador *"Toda a equipe / Só os meus"* na lista de lançamentos e **"Lançado
  por"** na tabela, nos cards e no detalhe. O Dashboard e os Relatórios já refletem o escopo por
  virem da mesma API — mas **não** ganharam alternador nem coluna de autoria.
- Organização `individual` não vê nada disso: menu, alternador e autoria só aparecem em `company`.

### Etapa 4 — Master: organizações — ✅ APLICADA em 19/08/2026
- Página **Organizações** no painel Master: lista com assentos em uso, criação de
  organização com equipe, e um painel de gestão por organização.
- Vincular conta existente por e-mail; trocar perfil; transferir titularidade;
  desvincular conforme a decisão 3, com registro em `farm_org_former_members`.
- Trava de assentos também no **consumo** do convite (`handle_new_farm_user`) —
  antes só a criação conferia, então reduzir o teto deixava convites pendentes
  entrarem assim mesmo.
- Tudo gravado no `farm_admin_audit` que já existe.

### Etapa 5 — Endurecimento — ✅ APLICADA em 19/08/2026 (QA da matriz pendente)
- **Funções expostas como RPC pública fechadas.** O Supabase publica toda função
  do schema `public` em `/rest/v1/rpc/<nome>`, e o GRANT padrão é `PUBLIC`. O caso
  que importava: **qualquer conta logada podia chamar `farm_process_recurring()`**
  direto pela API REST, materializando os previstos de *todas* as organizações.
  Agora só `postgres` (cron) e `service_role` (edge function).
- Helpers de RLS perderam `anon` e mantiveram `authenticated` — sem `EXECUTE` para
  `authenticated` a policy não é avaliada e **todo SELECT falha**.
- Advisor de segurança: de 30 avisos para 11.
- **Falta:** rodar a matriz da §8 com contas reais (§11).

### Etapa 6 — Backups e exportação no Master — ✅ PRONTA em 19/08/2026
- `GET /admin/export/org/:id` e `GET /admin/export/user/:id`: backup JSON sob
  demanda, auditado no `farm_admin_audit`.
- Botão em **Organizações** (por organização e por pessoa) e em **Usuários**
  (por pessoa). Baixa no web, folha de compartilhamento no iOS/Android.
- Rotina agendada **não** foi feita — só se a operação pedir.

---

## 7. Checklist de vazamento (revisar a cada etapa)

| Ponto | Risco | Etapa |
|---|---|---|
| `farmAi.ts` / WhatsApp | `service_role` filtrando só por org — vaza tudo para o membro | 2 |
| `/cron/weekly-summary` | manda total da org para todo telefone vinculado | 2 |
| `users_meta` | membro lê CPF/telefone dos colegas | 1 |
| `INSERT` sem `WITH CHECK` | registro atribuído a terceiro | 1 |
| Anexos (R2) | chave do anexo vem de query com RLS — **ok**, mas re-testar | 5 |
| `farm_notifications` | já é por usuário — **ok** | — |
| `farm_categories` / `farm_cost_centers` | visíveis para a org inteira — **intencional** (taxonomia compartilhada) | — |

---

## 8. Matriz de teste (critério de aceite)

Organização com: gestor **G**, usuários **U1** e **U2**, convidado **C**. Cada um lança 1 registro.

| Ação | G | U1 | U2 | C |
|---|---|---|---|---|
| Ver lançamento de U1 | ✅ | ✅ | ❌ | ✅ |
| Editar lançamento de U1 | ❌ | ✅ | ❌ | ❌ |
| Apagar lançamento de U1 | ❌ | ✅ | ❌ | ❌ |
| Criar lançamento | ✅ | ✅ | ✅ | ❌ |
| Total do dashboard | org | só o dele | só o dele | org |
| Ver a lista da equipe | ✅ | ❌ | ❌ | ❌ |
| Convidar alguém | ✅ | ❌ | ❌ | ❌ |
| Perguntar gastos no WhatsApp | org | só o dele | só o dele | leitura |

Verificar também: assinante avulso continua vendo 100% do que é dele, e um usuário **não** consegue
inserir registro com `created_by` de outra pessoa (tentativa direta na API).


---

## 9. Decisões de implementação (registradas na execução)

Coisas que o plano não previa e foram decididas ao escrever o código:

**Centro de custo sai da tela de Equipe.** Ele deixou de ser regra de
visibilidade, então continuar oferecendo "centros de acesso" no convite ensinaria
o gestor uma regra que não existe mais. A tabela `farm_user_cost_centers` fica no
banco (vazia) para uma futura restrição de *escrita* — "este usuário só lança no
CC Fazenda X".

**Lembrete continua pessoal; lançamento não.** `/receipts` devolve a equipe
inteira para quem enxerga a organização (é para isso que o perfil existe), e
aceita `?scope=mine`. `/tasks` faz o contrário: só os próprios por padrão, com
`?scope=all` disponível — to-do alheio na lista atrapalha mais do que ajuda.

**Recorrência deixou de ser exclusiva do gestor.** Se o usuário lança e edita o
que é dele, faz sentido cuidar das próprias recorrências; a posse é garantida
pela RLS. O `DELETE` ganhou uma checagem explícita de `created_by`: o gestor
*lê* a recorrência do usuário, e sem isso ele apagaria os lançamentos previstos
futuros de uma recorrência que não pode excluir (a limpeza roda com
`service_role`, antes do delete).

**Convidar virou recurso contratado.** `seats_limit` nulo vale 1, então uma
organização `individual` não gera mais convite — aparece o aviso de falar com o
suporte. É a trava comercial da decisão 1. Na prática não tira nada de ninguém:
nenhum convite foi usado até hoje.

**Permissão checada dentro do componente, não na prop.** `ReceiptItemsTable`,
`ReceiptViewDialog` e `ReceiptsListPage` consultam `isViewer` direto do
`AuthContext`. Uma prop `readOnly` que cada chamador precisa lembrar de passar é
exatamente o tipo de coisa que se esquece numa tela nova.

**O gestor convida; trocar perfil e desligar acesso são do Master.** A decisão 2
diz que o gestor convida a equipe, e o pedido original diz que os demais poderes
dele "por hora não precisamos implantar". Então a tela de Equipe ficou com lista
+ convite, e as duas ações que mexem em quem enxerga o financeiro da empresa
vivem no console do Master. Religar na tela do gestor é reexpor dois botões.

**`DELETE /members/:userId` foi desativado (403).** A implementação antiga
apagava a linha de `users_meta` e deixava a pessoa **sem organização** — o
`/auth/me` dela responde `no_organization` e o app trava numa mensagem que não
explica nada. Além de contrariar a decisão 3. O fluxo correto é
`DELETE /admin/orgs/:id/members/:userId`, que cria a organização individual, move
os vínculos e registra o ex-membro.

**Desvincular move os VÍNCULOS, nunca os dados.** Centro de custo do usuário,
link do WhatsApp e rascunho pendente do bot vão junto para a conta nova. O link
do WhatsApp é o crítico: esquecido, a pessoa continuaria lançando na empresa pelo
bot sem perceber. Os lançamentos ficam — é a decisão 3.

**Vincular um assinante que já tem histórico oferece DUAS saídas.** A primeira
versão só avisava que os lançamentos ficariam para trás — e o primeiro teste real
mostrou por que isso não bastava: a organização antiga fica **sem ninguém
dentro**, então o histórico não some só da vista do gestor, some para o próprio
dono. Agora a API devolve `409 user_has_data` e a tela pergunta:

- **Trazer junto** (`move_data`): move lançamentos, itens, lembretes e
  recorrências. O centro de custo vira o padrão do destino (o CC antigo é de
  outra organização e não existe do outro lado) e as categorias customizadas em
  uso são copiadas — senão a lista mostraria o slug cru no lugar do nome.
- **Deixar lá** (`confirm`): mantém o histórico na conta antiga e registra a
  pessoa como ex-membro de lá.

O anexo não precisa de nada: a chave do R2 é só um identificador, e quem lê passa
pelo lançamento — que já mudou de organização.

**A primeira pessoa vinculada a uma organização nova vira titular.** Organização
sem `owner` é um estado torto: o cron de alertas, por exemplo, procura o owner
quando não sabe para quem notificar.

**Editar/Excluir são checados por LINHA, não por perfil.** A primeira versão
escondia as ações só do convidado — então o gestor via o lançamento do colega
*com* o botão "Editar", clicava, preenchia e só descobria a regra quando a RLS
derrubava o `UPDATE`. Agora `useReceiptPermissions().canEdit(lançamento)` decide
por registro, na tabela, nos cards e no detalhe; a exclusão em lote filtra o que
é do próprio usuário e diz quantos manteve. O hook lê `canWriteOthers`, o mesmo
interruptor de `farm_can_write_others()` — o dia que o gestor puder editar tudo,
a interface acompanha sozinha.

**O cache de nomes da equipe é por sessão, e a interface não deduz remoção.**
Dois defeitos que só aparecem quando se troca de conta na mesma aba — que é
exatamente como se testa isso, e como funciona o "Login como" do Master:

1. `signOut` não recarrega a página (só limpa o estado do React), então o cache
   de módulo do `useOrgPeople` sobrevivia à troca de usuário. E `cache = {}` é
   *truthy*, então um resultado vazio nunca era refeito. Agora a chave é
   `user.id + organização`, resultado vazio ou falho não vira cache, e o
   `signOut` limpa o que ficou na memória.
2. A lista escrevia **"Removido da organização"** sempre que o nome não estava no
   mapa — uma afirmação tirada de uma ausência de dado, que acusava remoção de
   gente presente toda vez que a busca falhava. Agora `/members/names` devolve
   também os ex-membros (`farm_org_former_members`), e o rótulo só diz
   "(removido)" quando é verdade; nome desconhecido simplesmente não mostra
   rótulo.

**Menu ganhou `teamOnly` e `hideForViewer`.** "Equipe" volta ao menu, mas só em
organização `company`; "Recorrências" some para o convidado. O assinante avulso
não vê nada de time — a experiência dele é idêntica à de hoje.

---

## 10. Fora do escopo, mas encontrado no caminho

`POST /recurring/run-now` chama `farm_process_recurring()` **sem filtro de
organização**: o gestor de qualquer cliente dispara a materialização de
lançamentos previstos de **todas** as organizações. O efeito é o mesmo que o cron
das 07 UTC faria de qualquer jeito, então não vaza dado nem corrompe nada — mas é
um endpoint de um cliente com efeito em todos os outros. Vale restringir a master
ou passar o `organization_id`.


---

## 11. O que sobrou consciente

**Avisos de segurança aceitos.** Sobraram 11 no advisor, todos conhecidos:

- 6 × *"authenticated pode executar SECURITY DEFINER"* nos helpers de RLS. É
  inerente ao padrão: a policy é avaliada **como o usuário**, então sem `EXECUTE`
  para `authenticated` todo `SELECT` nas tabelas quebra. As funções devolvem o
  papel e a organização de quem chamou — coisas que a própria pessoa já sabe. A
  única forma de zerar o aviso é mover os helpers para um schema fora da API
  exposta, o que exige reescrever todas as policies; não compensa agora.
- 4 × *"RLS ligada sem policy"* em `billing_events`, `farm_admin_audit`,
  `farm_wa_pending` e `farm_wa_seen_messages` — intencional: são tabelas internas,
  só `service_role` toca.
- 1 × **proteção contra senha vazada desligada**. Esse vale ligar: é um toggle no
  painel do Supabase (Auth → Password) que checa a senha contra o
  HaveIBeenPwned na hora do cadastro.

**A matriz da §8 ainda não foi executada.** O MCP do Supabase é read-only e não
permite `set role`, então não deu para simular os perfis por SQL. O roteiro de
verificação está na §12 e leva ~15 minutos com contas reais.

---

## 12. Roteiro de verificação (~15 min)

### Preparar (5 min, tudo no painel Master)

1. **Usuários → Novo**, três vezes, com senha (não convite, para poder logar na
   hora): `gestor@teste.com`, `usuario@teste.com`, `convidado@teste.com`.
2. **Organizações → Nova**: nome "Teste Equipe", **4 acessos**.
3. **Gerenciar** → vincular os três e-mails. O primeiro vira **titular**; ajuste
   os outros dois para **Usuário** e **Convidado** no seletor.

> **A ordem importa.** Vincule **antes** de lançar qualquer coisa. Toda conta nova
> nasce dona da própria organização, então um lançamento feito antes do vínculo
> nasce na organização *antiga* — e o gestor abre a organização da equipe vazia,
> parecendo que a visibilidade não funciona. Foi exatamente o que aconteceu no
> primeiro teste real (19/08). Se cair nisso, use **Trazer junto** ao vincular.

### Os 6 testes que importam

| # | Como | O que TEM que acontecer |
|---|---|---|
| 1 | Entrar como **usuario@** e lançar "TESTE U1 — 100" | Salva normal |
| 2 | Entrar como **gestor@** e lançar "TESTE G — 200" | Vê **os dois**, e o do U1 traz *"Lançado por"*. O alternador **"Só os meus"** esconde o do U1 |
| 3 | Ainda como gestor, abrir o lançamento do U1 | **Não existe botão Editar/Excluir** — ele enxerga, não mexe |
| 4 | Voltar como **usuario@** | Vê **só o dele**. O do gestor não aparece em lugar nenhum, nem no total do Dashboard |
| 5 | Entrar como **convidado@** | Faixa roxa no topo, **nenhum botão de criar/editar**, menu sem Recorrências — e ainda assim vê os dois lançamentos |
| 6 | Como gestor, **Equipe → Convidar** | Gera código. Ao chegar em 4 pessoas+convites, o botão trava com o aviso de acessos esgotados |

### Se tiver WhatsApp vinculado (2 min)

7. Vincular o número no **usuario@** e perguntar *"quanto gastei esse mês?"* →
   tem que responder **só os 100**, nunca os 300 da organização.

### Limpar

Desvincular os três em **Organizações** (cada um sai com conta avulsa vazia) e
excluir as contas em **Usuários**. Os lançamentos de teste ficam na organização
de teste — que pode ser ignorada ou apagada direto no banco.

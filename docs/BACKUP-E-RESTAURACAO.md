# Backup e restauração — gerentia.app

**Início:** 24/08/2026 · **Etapas 0 a 5 concluídas** em 24/08/2026 · **Pendente:** conferir a 1ª rodada automática (§11b)

Documento-contrato. As etapas seguintes seguem o que está aqui; mudança de
regra se decide neste arquivo antes de virar código.

---

## 1. Por que, em uma linha

Até 24/08/2026 o app tinha um botão de exportar JSON no painel master, sob
demanda, incompleto e **sem nenhuma forma de restaurar**. O projeto Supabase
estava no plano Free, sem backup automático. O plano Free virou Pro no mesmo
dia — o diário do Supabase agora existe e é a rede de baixo.

Este sistema é a rede de cima: **segmentada** (dá para devolver os dados de uma
pessoa sem tocar no resto) e **operável pelo próprio usuário**.

## 2. O que o banco impõe

Quatro fatos levantados no banco em 24/08/2026 que determinam o desenho.

**As FKs para `auth.users` existem, e mudam o que a restauração alcança.**

> ⚠️ **Correção de 24/08/2026.** Até a etapa 3 este documento afirmava o
> contrário — "não existe FK para `auth.users`" — e a afirmação chegou a três
> mensagens de commit. Veio de uma consulta a `information_schema`, que só
> mostra constraints sobre objetos em que o papel tem privilégio: o usuário
> somente-leitura não enxerga `auth.users` e o resultado voltou vazio.
> `pg_constraint` não tem esse filtro. **Verifique FK por `pg_constraint`.**

O que existe de fato:

| tabela                                                                | coluna               | ao apagar o usuário              |
| --------------------------------------------------------------------- | -------------------- | -------------------------------- |
| `farm_receipts`                                                       | `created_by`         | **NO ACTION — barra a exclusão** |
| `farm_recurring_receipts`                                             | `created_by`         | NO ACTION                        |
| `farm_tasks`                                                          | `created_by`         | NO ACTION                        |
| `users_meta`                                                          | `user_id`            | CASCADE                          |
| `farm_categories`                                                     | `created_by_user_id` | **CASCADE**                      |
| `farm_whatsapp_links`, `farm_notifications`, `farm_user_cost_centers` | `user_id`            | CASCADE                          |
| `farm_admin_audit`                                                    | `target_user_id`     | SET NULL                         |

Três consequências:

1. **Usuário com lançamento não é apagável.** O banco recusa. É uma rede que
   ninguém tinha documentado, e é boa: o caminho certo para tirar alguém de uma
   organização é o desvínculo, não a exclusão.
2. **Restaurar dado de conta já apagada não funciona por si só.** O `created_by`
   do pacote aponta para um `auth.users` que não existe mais, e o insert é
   recusado. Recriar a conta dá um UUID novo, que não casa. **Limitação
   conhecida**, tolerável enquanto (1) impede o caso comum de chegar aqui.
3. **O pacote precisa congelar a identidade** de qualquer forma: pelo CASCADE de
   `users_meta`, o perfil some junto com a conta, e o pacote vira o único lugar
   que guarda o e-mail.

Um achado desta mesma conferência, já corrigido: `farm_categories.
created_by_user_id` era **CASCADE**, enquanto a tabela irmã
`farm_category_groups` usava `SET NULL` para a mesma coluna e o mesmo papel. A
migração 20260819150000 dizia que a coluna é "só autoria", mas a constraint
discordava: apagar o autor apagaria categorias que são da organização.

Risco concreto — as 67 categorias com autor preenchido são todas do mesmo
usuário (o plano de contas da Querência), e os 12 grupos dele sobreviveriam com
autor nulo. Meio destruído, pior que qualquer extremo. Alinhado para `SET NULL`
em `20260824170000_farm_categories_autoria_set_null.sql`.

**`organizations` cascateia em tudo.** Apagar uma linha lá derruba categorias,
grupos, centros de custo, lançamentos, itens, recorrências, pendências e
fazendas. Não existe rota de apagar organização na API — **manter assim**. Se um
dia existir, exige backup pré-operação (§7).

**Anexo apagado não existe.** `deleteFromR2` está escrito em `lib/r2.ts` e nunca
é chamado; apagar um lançamento não apaga o arquivo no R2. Portanto o pacote
**não copia arquivos de anexo** — restaurar o lançamento devolve o
`attachment_key`, que aponta para um arquivo que nunca saiu de lá.

> Se um dia o `deleteFromR2` passar a ser chamado, esta premissa cai e o pacote
> passa a precisar copiar os arquivos. Quem for mexer nisso lê este parágrafo.

**O agendador já existe.** Três jobs `pg_cron` ativos (`farm-process-recurring`,
`farm-process-alerts`, `farm-weekly-summary`). O diário é mais um no mesmo
padrão — cron chama rota da edge com o segredo do Vault.

## 3. Regras

**Restaurar repõe, nunca apaga.** Upsert por chave primária. Linha que existe
hoje e não está no pacote **fica**. Consequências, todas desejadas:

- é idempotente — rodar duas vezes não faz mal;
- não tem como piorar a situação, só empatar ou melhorar;
- cobre dado apagado (volta) e dado corrompido (é sobrescrito pelo valor bom).

**Pré-visualização é obrigatória.** Nenhuma restauração aplica sem antes dizer,
em números: quantas linhas vão ser **repostas** (sumiram), quantas
**sobrescritas** (mudaram desde o pacote) e quantas ficam **intactas**. Sem
isso ninguém tem coragem de apertar o botão, e quem apertar não vai saber o que
fez.

**Dependência que sumiu é reposta; dependência que existe não é tocada.** Se o
lançamento do membro aponta para um centro de custo que foi apagado, a
restauração insere o centro de custo antes — senão o lançamento não entra.
Nunca sobrescreve um que já existe.

**Backup igual ao anterior não vira arquivo.** Compara o hash do bloco de dados
(sem o carimbo de hora, senão todo dia difere). Se não mudou nada, registra
"sem alteração" apontando para o arquivo anterior.

**Toda restauração vai para `farm_admin_audit`.** Quem, quando, qual pacote, o
que mudou.

## 4. Quem pode o quê

|                      | consultar       | baixar | restaurar                                   |
| -------------------- | --------------- | ------ | ------------------------------------------- |
| membro               | o que ele criou | idem   | **só o que ele criou** (`created_by` = ele) |
| gestor (owner/admin) | a organização   | idem   | **a organização inteira**                   |
| convidado (viewer)   | —               | —      | —                                           |
| master               | tudo            | tudo   | tudo                                        |

O gestor restaurando a organização sobrescreve linhas criadas por outros
membros. É deliberado: espelha o que ele já pode ler e administrar, e a
pré-visualização mostra quantas linhas são de cada pessoa antes de aplicar.

## 5. Onde ficam os arquivos

**Cloudflare R2**, balde `gerentia-r2-backup-bucket` — separado do de anexos. Fora do Supabase de
propósito: backup guardado dentro do projeto que ele protege cobre erro humano,
não cobre perder o projeto. O cliente R2 (`lib/r2.ts`) e os secrets
`GERENTIA_R2_*` já existem e funcionam.

**Credencial própria por balde.** O token do R2 é escopado por balde na
Cloudflare, e o que já existia só alcançava o de anexos — a primeira gravação
levou `403 Access Denied`. Em vez de ampliar o token dos anexos (que funciona em
produção, e editá-lo pode rotacionar a chave e derrubar o envio de recibo),
existe um segundo token só para backup:

- `GERENTIA_R2_BACKUP_ACCESS_KEY_ID`
- `GERENTIA_R2_BACKUP_SECRET_ACCESS_KEY`

Opcionais: sem eles o código cai nas chaves principais. Mas é o que torna a
separação dos baldes real — o upload de anexo é disparado por qualquer usuário
que manda um recibo, e o backup é justamente o que socorre quando esse caminho
dá errado.

Caminho: `{escopo}/{alvo}/{tipo}-{AAAA-MM-DD}.json`

    organizacao/a5a94716-…/diario-2026-08-24.json
    usuario/8f21c4de-…/saida-2026-08-24.json
    geral/diario-2026-08-24.json

## 6. Retenção

| tipo           | guarda   | por quê                                                                               |
| -------------- | -------- | ------------------------------------------------------------------------------------- |
| `diario`       | 30 dias  | o caso comum: percebeu na semana                                                      |
| `mensal`       | 12 meses | "só vi em setembro que sumiu em julho". O banco inteiro tem 472 KB — custa quase nada |
| `manual`       | 90 dias  | alguém pediu de propósito, merece sobreviver ao mês                                   |
| `saida`        | 90 dias  | usuário excluído ou desvinculado                                                      |
| `pre-operacao` | 90 dias  | retrato antes de operação destrutiva                                                  |

`saida` e `pre-operacao` têm prazo maior, mas **têm prazo**. Guardar dado
pessoal indefinidamente é exatamente o que um pedido de LGPD vai cobrar; 90 dias
com expurgo automático é defensável, "para sempre" não é.

## 7. Backup antes de operação destrutiva

Antes de excluir usuário (`DELETE /admin/users/:id`) e de desvincular membro
(`DELETE /admin/orgs/:id/members/:userId`), gera-se um pacote `saida` do alvo
(`lib/backupSaida.ts`). **Se a gravação falhar, a operação é abortada** — não se
apaga o que não se sabe repor. Ideia emprestada do CDM, que é a parte que lá
funciona de verdade.

A chave do pacote entra no `farm_admin_audit` junto da ação e volta na resposta,
para o registro de "excluí o fulano" já trazer onde está o retrato dele.

**É pacote de USUÁRIO, não de organização, e o momento importa.** Ao excluir a
conta, `users_meta` cascateia junto e o e-mail desaparece. O pacote congela a
identidade e vira o único lugar que guarda quem era a pessoa.

Vale o alerta do §2: usuário com lançamento **não é apagável** — o banco recusa
—, então o retrato da exclusão cobre contas sem movimento. Para quem tem dados o
caminho é o desvínculo, e aí o retrato é plenamente restaurável, porque a conta
continua existindo.

No desvínculo nada é apagado (os lançamentos ficam com a organização, decisão 3
de `ORGANIZACOES-E-PERFIS.md` §3), mas os vínculos mudam de dono e a pessoa vai
para uma organização nova. Desfazer isso à mão é trabalhoso; o retrato torna
reversível.

`DELETE /members/:userId` não precisa de retrato: já responde 403 desde que o
fluxo correto passou a ser o do painel master.

## 8. Formato do pacote — versão 1

```jsonc
{
  "versao": 1,
  "gerado_em": "2026-08-24T18:00:00.000Z",
  "gerado_por": "uuid do master, ou null quando é o cron",
  "escopo": "geral | organizacao | usuario",
  "tipo": "diario | mensal | manual | saida | pre-operacao",
  "alvo": {
    // congelado no momento do backup: a conta pode não existir mais na hora
    // de restaurar, e aí este bloco é a única forma de saber de quem era
    "organization_id": "…",
    "organization_name": "…",
    "user_id": "…",
    "user_email": "…",
    "user_name": "…",
  },
  "contagem": { "farm_receipts": 94, "farm_receipt_items": 31 },
  "hash": "sha256 do bloco `tabelas`",
  "tabelas": {
    "farm_receipts": [
      /* linhas cruas */
    ],
  },
}
```

`versao` existe desde o primeiro arquivo. Sem ela, o pacote gravado hoje não é
legível pelo restaurador de amanhã — e é justamente o pacote antigo que se
precisa ler numa emergência.

`hash` cobre só `tabelas`. Se cobrisse o arquivo inteiro, `gerado_em` mudaria o
hash todo dia e a regra de "não gravar igual" nunca dispararia.

## 9. Ordem das tabelas

Coleta e restauração seguem esta ordem — é a de dependência:

1. `organizations`
2. `users_meta`
3. `farms`
4. `farm_cost_centers`
5. `farm_category_groups`
6. `farm_categories`
7. `farm_recurring_receipts`
8. `farm_receipts` → depende de farms, cost_centers, recurring
9. `farm_receipt_items` → depende de receipts
10. `farm_tasks`, `farm_user_cost_centers`, `farm_whatsapp_links`,
    `farm_notifications`, `farm_org_invites`, `farm_org_former_members`,
    `farm_category_hidden`

Fora do pacote de propósito: `farm_admin_audit` e `farm_alert_log` (registro
operacional, não é dado do cliente), `farm_wa_pending`, `farm_wa_seen_messages`
e `farm_whatsapp_link_codes` (efêmeros), `plans`, `subscriptions`,
`billing_customers`, `billing_events` (cobrança, tem fonte própria).

## 10. Etapas

|       | o que                                                                    | estado        |
| ----- | ------------------------------------------------------------------------ | ------------- |
| **0** | Coletor, formato v1, gravação no R2, índice `farm_backups`               | ✅ 24/08/2026 |
| **1** | Diário automático via `pg_cron`, com hash e expurgo                      | ✅ 24/08/2026 |
| **2** | Restauração: pré-visualização, transação, auditoria. Só master, sem tela | ✅ 24/08/2026 |
| **3** | Backup pré-operação destrutiva (§7)                                      | ✅ 24/08/2026 |
| **4** | Tela do usuário em Configurações                                         | ✅ 24/08/2026 |
| **5** | Tela do master                                                           | ✅ 24/08/2026 |

Restauração vem **antes** das telas de propósito. Backup que nunca foi
restaurado é fé, não backup — melhor descobrir os problemas dela com o master no
controle do que depois de uma tela ter prometido o botão para o cliente.

As telas das etapas 4 e 5 seguem `docs/PADRAO-DE-PAGINA.md`.

## 11. O diário (etapa 1)

Job `gerentia-daily-backup`, **05:00 UTC = 02:00 de Brasília**. O fuso do
`pg_cron` neste projeto é GMT — conferido em `current_setting('cron.timezone')`,
não suposto.

O horário é antes das recorrências (07:00 UTC), que **escrevem** lançamentos: o
retrato do dia tem que ser anterior a qualquer escrita automática, senão o
backup já vem com o que o robô criou em vez do que existia.

Um pacote por organização com membro e um por usuário. No dia 1 do mês grava
também um `mensal`, reaproveitando a mesma coleta — mesmo conteúdo, prazo
diferente. O expurgo roda na mesma passada.

Um alvo que falha não derruba a rodada: numa tarefa que roda sozinha de
madrugada, parar tudo porque uma organização deu erro significaria perder o
backup de todas as outras.

### Duas armadilhas que a rodada de teste revelou

**`extensions.net.http_post` não existe.** O `pg_net` cria as funções em `net`.
Com o prefixo, o Postgres lê banco.schema.função e recusa. E isto não era erro
novo: `farm-process-alerts` falhava assim **83 vezes desde 03/06/2026** e
`farm-weekly-summary` **12 vezes** — o alerta de vencimento por WhatsApp e o
resumo semanal **nunca dispararam em produção**. Corrigido em
`20260824140000_fix_cron_net_schema.sql`.

**O default de `net.http_post` é 5 s.** A rodada leva ~17 s. A edge não morre
junto (o backup completa), mas a resposta se perde — e aí o único registro é um
"timeout" que tem a mesma aparência de sucesso e de desastre. Subido para 120 s
em `20260824150000_cron_backup_timeout.sql`.

As duas têm a mesma moral: **cron que falha é silencioso**. Um job quebrado e um
job sem trabalho são indistinguíveis de fora. É também a razão de a etapa 2 vir
antes das telas.

### Buraco na retenção, fechado junto

Alvo que nunca muda tem o backup pulado pela regra do hash todo dia — e o único
arquivo que existe acabaria vencendo pelo `expira_em`, deixando o alvo **sem
backup nenhum justamente por nada ter acontecido com ele**. Pular agora **renova
o prazo** do arquivo que ficou valendo. `criado_em` não se mexe: o conteúdo
continua sendo o do dia em que foi capturado; o que muda é até quando vale.

## 11b. PENDENTE — conferir a primeira rodada automática

O `gerentia-daily-backup` foi validado por disparo manual, **nunca por si só**.
A primeira execução espontânea é às 05:00 UTC do dia seguinte a 24/08/2026.

Confira no SQL Editor:

```sql
select j.jobname, d.status, d.start_time::timestamp(0), left(d.return_message, 80)
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
where d.start_time > now() - interval '2 days'
order by d.start_time desc;
```

Três coisas a olhar, e as duas últimas não são sobre backup:
`gerentia-daily-backup` em `succeeded`, e `farm-process-alerts` e
`farm-weekly-summary` também — esses dois falhavam todo dia desde junho até a
correção de 24/08 (`20260824140000_fix_cron_net_schema.sql`), e esta é a primeira
oportunidade de vê-los funcionando.

Enquanto esta seção existir, o item está em aberto. Apague-a quando conferir.

## 12. A restauração (etapa 2)

`public.farm_restaurar_backup(p_ordem, p_tabelas, p_somente_inserir, p_aplicar)`.

**É uma função no banco, não código na edge.** A restauração toca várias tabelas
em ordem de dependência; feita por chamadas REST soltas, uma falha no meio
deixaria metade restaurada — o pior estado possível, porque parece que deu
certo. Uma função é uma transação: ou entra tudo, ou não entra nada.

Três cuidados que valem a leitura do SQL:

**A chave primária vem do catálogo**, não escrita à mão. Três tabelas do pacote
têm chave composta (`farm_category_hidden`, `farm_org_former_members`,
`farm_user_cost_centers`); uma lista fixa envelheceria em silêncio.

**As colunas são a interseção** entre o que o pacote traz e o que a tabela tem
hoje. Coluna que sumiu é ignorada; coluna criada depois do backup **não é
mexida**, em vez de virar NULL — restaurar um pacote antigo não pode apagar dado
de uma coluna que ele nem conhecia.

**Os dois lados passam pelo mesmo tipo de linha antes de comparar**
(`jsonb_populate_recordset` + `to_jsonb`). Comparar o JSON cru do pacote contra
`to_jsonb` da tabela daria falso "sobrescrita" toda vez que a serialização de
data ou numérico diferisse por um detalhe de formato — e a pré-visualização
prometeria mudanças que não existem.

A lista de tabelas aceitas é fixa dentro da função. Ela é `SECURITY DEFINER` e
monta SQL dinâmico: sem essa trava, um nome de tabela arbitrário em `p_ordem`
viraria escrita arbitrária no banco. Execute revogado de `anon` e
`authenticated` — só a edge chama, e quem decide o recorte é o handler.

### Rotas

    GET  /admin/backups/:id/url      link presigned de 5 min para baixar
    POST /admin/backups/:id/restore  { aplicar: false } pré-visualiza

## 13. A tela do usuário (etapa 4)

`Configurações → Backups`, no hub de atalhos. Segue `docs/PADRAO-DE-PAGINA.md`.

Rotas próprias, separadas das do master:

    GET  /backups              lista — a RLS faz o recorte
    POST /backups/run          backup manual agora
    GET  /backups/:id/url      link temporário
    POST /backups/:id/restore  pré-visualiza e restaura

**A listagem confia na RLS** e não repete a regra de quem vê o quê: duas fontes
divergiriam no primeiro ajuste. **A restauração não pode fazer o mesmo** — roda
com `service_role`, que passa por cima da RLS —, então a permissão é conferida à
mão contra o registro do backup, numa função só (`podeRestaurar`).

**A pré-visualização É o diálogo.** Clicar em Restaurar não restaura: chama o
servidor com `aplicar: false` e abre a confirmação já com os números calculados
— quantas linhas voltam, quantas são sobrescritas, quantas ficam. A frase
"restaurar nunca apaga" vai junto, porque é a dúvida que trava a mão de quem
está com medo.

**Sem busca, de propósito:** a lista é curta e o que se procura é uma data, que
já está em cada card. Os filtros são escopo (meus / da organização) e tipo.

Uma sutileza de linguagem: quando `gravou: false`, a tela diz _"nada mudou desde
o último backup; o anterior continua valendo"_, não "erro". É o comportamento
correto do §3 e chamá-lo de falha faria o cliente gerar backup até desistir.

## 14. A tela do master (etapa 5)

`Configurações → Backups de Todos`, só para master. **É o mesmo componente**
(`BackupsManager`, com `master`), não uma segunda tela.

Duas telas separadas seriam duas listas, dois cards e dois diálogos de
pré-visualização para divergir — e a pré-visualização é justamente a peça que
não pode ficar diferente entre quem opera e quem é operado. O flag troca só o
necessário: a rota (`/admin/backups`, que não passa pela RLS), a busca por
pessoa ou organização, o seletor de alvo ao gerar, o rótulo do card (o e-mail do
alvo em vez de "meus dados", porque o master olha uma lista de gente e não a
própria) e o botão de excluir.

`DELETE /admin/backups/:id` apaga do R2 e depois do índice — mesma ordem do
expurgo automático, e pelo mesmo motivo.

**Limitação assumida:** o alvo do disparo manual é um campo de UUID, não um
seletor de organizações e pessoas. É o único ponto da tela abaixo do padrão. O
caso é raro (o diário cobre o dia a dia) e os IDs estão à mão nas telas de
Usuários e Organizações. Vira seletor quando incomodar.

## 15. Validação — 24/08/2026

### Etapa 0 — `POST /admin/backups/run`, três chamadas

| verificação                                         | resultado                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Coleta do usuário bate com conferência independente | 3 lançamentos, 3 itens, 5 CC, **67 categorias** — igual ao levantamento feito direto no banco |
| Segunda chamada idêntica não grava                  | duas linhas no índice para três chamadas                                                      |
| Identidade congelada                                | e-mail e nome da organização gravados                                                         |
| Retenção                                            | `manual` → expira 22/11/2026 (90 dias)                                                        |
| Upload antes do índice                              | no `403` do R2 o índice ficou vazio, sem linha órfã                                           |

Um número que parece errado e não é: os pacotes de **usuário** e de
**organização** saíram com o **mesmo hash**. A organização do alvo tem um único
membro e os três lançamentos são dele, então os dois recortes contêm exatamente
as mesmas linhas. Os arquivos diferem em 126 bytes — o bloco `alvo`, que carrega
o e-mail e fica **fora** do hash de propósito. Prova acidental de que o hash
cobre só `tabelas`.

### Etapa 1 — disparo por `pg_net`, igual ao cron, com o segredo do Vault

Primeira rodada: **11 organizações e 14 usuários**, todos gravados — batendo com
`count(distinct organization_id)` e `count(*)` em `users_meta`.

Segunda rodada, minutos depois:

    {"ok":true,"organizacoes":11,"usuarios":14,
     "sem_alteracao":25,"arquivos_gravados":0,"expurgados":0,"falhas":[]}

25 alvos, nenhum arquivo novo: a regra do hash vale em escala, não só no caso de
um usuário. E o `status_code: 200` com o resumo dentro de `net._http_response` é
a observabilidade que faltava aos outros dois jobs.

### Etapa 2 — quatro cenários, todos dentro de transação revertida

**Pacote igual ao estado atual** (4 tabelas, 78 linhas): `78 intactas, 0
repostas, 0 sobrescritas`. Zero falso positivo — é o teste que pega erro de
serialização.

**Perda total e volta:** 2 lançamentos → apagados → previsão diz `2 repostas` →
**a previsão não escreveu nada** (contagem seguiu em 0) → aplicado → 2 de volta
→ aplicado de novo: `2 intactas, 0 repostas`. Idempotente.

**Linha corrompida** (descrição e valor trocados por lixo): previsão acusou
`1 sobrescrita, 1 intacta`, e aplicar devolveu o valor original.

**Modo somente-inserir sobre a mesma linha corrompida:** previsão prometeu
`0 sobrescritas, 2 intactas`, e aplicar de fato **não tocou** na linha errada —
o contexto da organização fica protegido no pacote de usuário, como manda o §3.

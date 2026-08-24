# Backup e restauração — gerentia.app

**Início:** 24/08/2026 · **Etapa 0 concluída** em 24/08/2026 · **Próxima:** 1

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

**Não existe FK para `auth.users`.** `created_by` e `user_id` são UUID solto.
Dá para restaurar os dados de alguém cuja conta de acesso já foi apagada — o
dado não depende da conta existir. Em troca, apagar um usuário deixa linhas
órfãs sem erro e sem aviso: **o pacote precisa congelar a identidade**
(id, e-mail, nome), senão restaura-se a linha sem saber de quem era.

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
(`DELETE /admin/orgs/:id/members/:userId`), gerar pacote `saida` do alvo. **Se a
gravação falhar, a operação é abortada** — não se apaga o que não se sabe
repor. Ideia emprestada do CDM, que é a parte que lá funciona de verdade.

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
| **1** | Diário automático via `pg_cron`, com hash e expurgo                      |               |
| **2** | Restauração: pré-visualização, transação, auditoria. Só master, sem tela |               |
| **3** | Backup pré-operação destrutiva (§7)                                      |               |
| **4** | Tela do usuário em Configurações                                         |               |
| **5** | Tela do master                                                           |               |

Restauração vem **antes** das telas de propósito. Backup que nunca foi
restaurado é fé, não backup — melhor descobrir os problemas dela com o master no
controle do que depois de uma tela ter prometido o botão para o cliente.

As telas das etapas 4 e 5 seguem `docs/PADRAO-DE-PAGINA.md`.

## 11. Validação da etapa 0 — 24/08/2026

Disparo manual por `POST /admin/backups/run`, três chamadas:

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

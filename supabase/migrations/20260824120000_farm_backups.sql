-- Gerentia — índice dos backups. Etapa 0 de docs/BACKUP-E-RESTAURACAO.md.
--
-- O CONTEÚDO do backup vai para o Cloudflare R2 (fora do Supabase de propósito:
-- backup guardado dentro do projeto que ele protege cobre erro humano, não
-- cobre perder o projeto). Esta tabela é só o ÍNDICE — o que existe, de quem,
-- de quando, quanto pesa e onde está.
--
-- Por que um índice em vez de listar o bucket direto:
--
--  * a tela precisa mostrar "94 lançamentos, 31 itens" sem baixar o arquivo;
--  * a regra de "não gravar backup igual ao anterior" compara `hash`, e
--    comparar exige ler o anterior — uma consulta, não um download;
--  * expurgo por `expira_em` vira uma query, não um passeio pelo bucket;
--  * RLS aqui é o que deixa o próprio usuário consultar os backups dele sem
--    ganhar acesso ao R2.
--
-- O índice pode divergir do bucket (gravou a linha, falhou o upload). Quem
-- escreve grava a linha DEPOIS do upload, então a divergência possível é
-- arquivo órfão no R2 — que o expurgo limpa — e nunca linha apontando para
-- arquivo que não existe.

create table if not exists public.farm_backups (
  id uuid primary key default gen_random_uuid(),

  -- 'geral' = o banco inteiro (só master). 'organizacao' e 'usuario' são os
  -- recortes que permitem devolver os dados de um sem tocar no resto.
  escopo text not null check (escopo in ('geral', 'organizacao', 'usuario')),

  -- Nulos quando escopo='geral'. `user_id` só quando escopo='usuario'.
  -- SEM foreign key para organizations, de propósito: o backup de uma
  -- organização apagada é justamente o que se precisa depois de apagá-la, e um
  -- cascade levaria o índice junto com o que ele deveria ajudar a recuperar.
  organization_id uuid,
  user_id uuid,

  -- Ver §6 do doc. Muda a retenção e nada mais.
  tipo text not null default 'diario'
    check (tipo in ('diario', 'mensal', 'manual', 'saida', 'pre-operacao')),

  -- Versão do FORMATO do pacote, não desta tabela. O restaurador de amanhã
  -- precisa saber ler o arquivo de hoje — e é o arquivo antigo que se lê numa
  -- emergência.
  versao integer not null default 1,

  -- Caminho no R2: organizacao/{id}/diario-2026-08-24.json
  chave text not null,
  bytes bigint not null default 0,

  -- sha-256 do bloco `tabelas` (sem o carimbo de hora — senão todo dia difere
  -- e a regra de "não gravar igual" nunca dispara).
  hash text not null,

  -- {"farm_receipts": 94, "farm_receipt_items": 31} — para a tela mostrar o
  -- tamanho do estrago sem baixar nada.
  contagem jsonb not null default '{}'::jsonb,

  -- Identidade CONGELADA do alvo (e-mail, nome da organizacao). users_meta
  -- cascateia quando a conta de auth e apagada, entao este bloco vira o unico
  -- lugar que guarda quem era a pessoa.
  identidade jsonb not null default '{}'::jsonb,

  criado_em timestamptz not null default now(),
  -- Quem disparou. Null = cron.
  criado_por uuid,
  -- Null = não expira. O expurgo da etapa 1 lê daqui.
  expira_em timestamptz
);

-- Um pacote por alvo, por tipo, por dia. Rodar o cron duas vezes no mesmo dia
-- atualiza a linha em vez de duplicar.
--
-- O dia sai em UTC, e explicitamente. Duas razões:
--  1. `criado_em::date` sozinho é STABLE (depende do TimeZone da sessão) e o
--     Postgres recusa em índice — só `timezone(text, timestamptz)` é IMMUTABLE;
--  2. a chave do arquivo no R2 é fatiada do ISO (`gerado_em.slice(0,10)`), que
--     é UTC. Fusos diferentes aqui e lá dariam duas linhas para o mesmo arquivo
--     perto da virada do dia.
create unique index if not exists farm_backups_alvo_dia
  on public.farm_backups (
    escopo,
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(user_id,         '00000000-0000-0000-0000-000000000000'::uuid),
    tipo,
    ((criado_em at time zone 'UTC')::date)
  );

-- A consulta da tela: "os backups deste alvo, mais recentes primeiro".
create index if not exists farm_backups_por_org
  on public.farm_backups (organization_id, criado_em desc);
create index if not exists farm_backups_por_usuario
  on public.farm_backups (user_id, criado_em desc);
-- A consulta do expurgo.
create index if not exists farm_backups_expira
  on public.farm_backups (expira_em) where expira_em is not null;

-- ============================================================
-- RLS — leitura espelha o que a pessoa já enxerga no app
-- ============================================================
--
-- ESCRITA NÃO TEM POLICY NENHUMA, de propósito. Quem grava é a edge function
-- com service_role (que passa por cima de RLS) e o cron. Cliente nenhum inventa
-- linha de backup, nem apaga a linha que prova que o backup existia.

alter table public.farm_backups enable row level security;

drop policy if exists "backups select" on public.farm_backups;

create policy "backups select" on public.farm_backups
  for select to authenticated
  using (
    -- Membro comum: só os backups do que ele criou.
    (escopo = 'usuario' and user_id = auth.uid())
    -- Gestor e convidado: os da organização, inclusive os por usuário dos
    -- colegas — é o mesmo alcance que eles já têm sobre os dados em si.
    or (
      organization_id is not null
      and organization_id = public.farm_current_org_id()
      and public.farm_can_read_all()
    )
  );

-- O master não entra na policy: ele opera pela edge function com service_role,
-- que não passa por RLS. Colocá-lo aqui exigiria replicar a lista de e-mails
-- master dentro do banco — uma segunda fonte de verdade para divergir.

comment on table public.farm_backups is
  'Índice dos backups; o conteúdo fica no Cloudflare R2. Ver docs/BACKUP-E-RESTAURACAO.md.';
comment on column public.farm_backups.hash is
  'sha-256 do bloco `tabelas` do pacote. Igual ao anterior = nada mudou, não grava arquivo novo.';
comment on column public.farm_backups.identidade is
  'E-mail/nome congelados no momento do backup. Não há FK para auth.users: quando a conta some, é o que resta para identificar as linhas.';

# Cropware Farm — Roadmap

> Visão de onde o produto está: o que foi entregue, o que está em standby e o
> que vem a seguir. Para mudanças granulares por data, ver `CHANGELOG.md`.
>
> Última atualização: 2026-05-30.

---

## O que é o Farm

Gestão financeira e administrativa para fazendas — parte do ecossistema
Cropware. Web app (React + Vite + Supabase) com captura de lançamentos por
foto/WhatsApp (OCR via Gemini), organização por Centros de Custo e categorias.

Roda no projeto Supabase `tzsmxhwvtobwkqffgsxo` (compartilhado com o Cropware
Studio durante o piloto). Domínio de produção: farm.cropware.com.br.

---

## Status atual: V1.5 — polimento visual + organização

A fase atual foca em **consistência visual com o Cropware CDM** e em maturar a
superfície web existente. WhatsApp bot e empacotamento iOS (Capacitor) estão
**pausados** até o polimento fechar.

---

## ✅ Entregue

### Fundação (V1, commits 1–8c)
- Scaffolding Vite 6 + React 18 + TS strict + Tailwind v4 + shadcn/ui.
- Auth (Supabase) + multi-tenant por organização + RLS.
- CRUD de lançamentos (despesas/receitas) com status, categoria, anexo.
- Captura de recibo por foto → OCR Gemini → revisão → salvar.

### Rodadas de features (R1–R3, até 2026-05-28)
- **R1** — áudio no WhatsApp (transcrição Gemini), marcar conta como paga via
  bot, lançamentos recorrentes (cron diário).
- **R2** — dashboard com gráficos (recharts: 6 meses + top categorias),
  exportação CSV.
- **R3** — alertas de vencimento e resumo semanal (código pronto), perguntas
  sobre CC e data no bot conversacional.

### RBAC + Centros de Custo
- Papéis owner/admin/member. Convites por código de 6 dígitos.
- Centros de Custo (limite 6 ativos) com acesso por membro.

### Polimento visual (V1.5, sessões 2026-05-27 a 2026-05-30)
- Migração de brand laranja → **slate**, alinhado ao CDM.
- Tipografia Inter Tight + escala fixa 14/13/16 + badges 12.5 Title Case.
- Logo reusando asset oficial do CDM.
- Header/sub-header/tab bar/breadcrumb espelhados do CDM.
- Tela de login estilo CDM (paleta slate).
- Tabelas estilo CDM PlotManagement (seleção em lote, ações Ver/Editar/Excluir,
  dialog de detalhes).
- Barra de filtros com SearchableSelect + MultiSearchableSelect (busca, grupos).
- Arquitetura de scroll no `<main>` (100dvh, sem page-squeeze).
- Acentuação correta em todo texto visível.

### Pivot CC-only + Configurações (2026-05-30)
- Centro de Custo vira o conceito universal de organização financeira;
  "Fazenda" fica legado (escondida do menu). Atende produtor, agrônomo
  consultor e revenda multi-usuário.
- Signup seedeia 3 CCs em vez de 1.
- Categorias: 52 presets agrupados (Fazenda/Pessoal/Escritório/Viagem/
  Financeiro/Receitas).
- Aba **Configurações** (sub-tabs Centros de Custo + Categorias).
- Categorias custom por usuário + ocultar presets por org.

---

## ⏸️ Standby (retomar após o polimento)

- **WhatsApp bot** — código existe (handler, OCR, áudio, recorrência), mas a
  feature está pausada. Pendências não-código: aprovar 2 templates Meta
  (alerta_vencimento, resumo_semanal) + validar disparo real dos crons.
- **Capacitor / app iOS** — empacotamento nativo planejado, não iniciado.

---

## 🔜 Próximos passos candidatos

> Não priorizados ainda — lista de candidatos para a próxima rodada.

- Finalizar validação dos alertas WhatsApp (templates Meta + crons em produção).
- Polimento visual das telas restantes (Dashboard, Conta, Equipe, Recorrências)
  no mesmo padrão de Lançamentos/Configurações.
- Open Finance (Pluggy/Belvo/Klavi) — estudo feito, pausado. Pluggy R$2.5k/mês,
  break-even ~50-83 usuários.
- Empacotamento Capacitor + publicação iOS.

---

## Decisões de arquitetura registradas

- **Roteamento:** rotas de verdade (URL muda por aba). Deep-link + refresh +
  back/forward funcionam.
- **CC-only:** Centro de Custo é o eixo de organização; Fazenda é legado.
- **Supabase compartilhado** com o Studio durante o piloto (economia de custo).
- **Categorias:** preset global + custom por usuário; ocultação por org.
- **Design:** consistência visual literal com o CDM (ver `FARM-DESIGN-SYSTEM.md`).

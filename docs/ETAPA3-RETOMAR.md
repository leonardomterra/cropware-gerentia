# Etapa 3 — itens adiados (prompt para retomar)

Cole o bloco abaixo numa nova sessão do Claude Code quando quiser retomar os
refactors de baixo risco que ficaram fora da Etapa 3 (Visual/UI + a11y).
Contexto completo em [PRE-LAUNCH-AUDIT.md](PRE-LAUNCH-AUDIT.md) → seção
"Etapa 3 → 🟡 Adiado".

---

```
Retomar os itens ADIADOS da Etapa 3 (Visual/UI + a11y) da auditoria pré-lançamento
do gerentia.app. O contexto completo está em docs/PRE-LAUNCH-AUDIT.md (seção
"Etapa 3 → 🟡 Adiado"). Leia esse arquivo primeiro.

Os itens (ordenados por valor/esforço — me proponha a ordem e confirme antes de ir):

1. Associar <Label> aos Select / SearchableSelect / MultiSearchableSelect (leitor
   de tela não anuncia o nome). Caminho barato: prop aria-label no trigger do
   SearchableSelect (src/components/ui/searchable-select.tsx) + nos SelectTrigger.
   Afeta: ReceiptFormDialog, RecurringPage, ReceiptFiltersBar, CategoriesManager.

2. Padronizar estados de VAZIO e LOADING app-wide: adotar o componente
   src/components/ui/EmptyStateCard.tsx (hoje morto/não usado) e um skeleton em vez
   de "<p>Carregando...</p>" cru. Hoje há ~5 tratamentos divergentes
   (RecurringPage, ReportsPage, ReceiptsCards, CategoriesManager, CostCentersManager,
   AdminUsersPage). Antes, converter os hex inline do EmptyStateCard p/ tokens slate.

3. Trocar confirm()/alert() nativo por dialog estilizado (ConfirmActionDialog/
   DeleteConfirmationDialog já existem) em RecurringPage, CostCentersManager e
   AdminUsersPage (handleReset/Delete/Impersonate).

4. Consolidar os 2 sistemas de botão de toolbar: Button (h-9, rounded) vs os
   hand-rolled (bg-slate-100, rounded-md) em ReceiptsListPage/ReportsPage/
   DashboardPage/AdminUsersPage. Criar uma variant "secondary" ou um
   ToolbarSelectButton. E usar ActionIconButton nos 3 managers que reimplementam
   o botão de ação (RecurringPage, CostCentersManager, CategoriesManager).

5. Nits: ellipsis "..." → "…"; spacing de ícone (mr-1/mr-1.5 → gap do Button);
   AdminUsers "+" → ícone Plus; contraste text-slate-400 → slate-500/600 em infos
   reais do Dashboard; accessibilityLayer nos charts; skip-link p/ <main>;
   no PDF (reportExport.ts) usar <dl> + alt contextual nos anexos.

6. CostCentersPage standalone duplicado (legado) — confirmar se ainda está roteado;
   se não, deletar (ver memória rebrand-cleanup-pending).

Regras: só frontend, rodar `npx tsc --noEmit` + `npm run build` a cada bloco,
commits pequenos por item, e atualizar docs/PRE-LAUNCH-AUDIT.md marcando o que foi
feito. Não mexer em backend/migrations.
```

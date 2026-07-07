/**
 * Estilo único do gatilho cinza de dropdown/popover na toolbar (Centro de Custo,
 * Ordenar, Mês, Período, filtros). Antes era duplicado à mão em cada toolbar.
 * Use `cn(TOOLBAR_TRIGGER_CLASS, "<classes de layout>")` e sobreponha o que
 * precisar (ex.: estado ativo escuro). Pareado com o componente `Button`
 * (ações) — este é a "outra metade" do sistema de botões, agora centralizada.
 */
export const TOOLBAR_TRIGGER_CLASS =
  "h-9 inline-flex items-center gap-1.5 px-3 rounded-md cursor-pointer transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 [&>svg]:size-[18px]";

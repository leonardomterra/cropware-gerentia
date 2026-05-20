/**
 * Sistema unificado de z-index do Cropware.
 *
 * REGRA GERAL — sempre use estes tokens em vez de números mágicos.
 * Documenta a hierarquia visual e evita regressões quando subimos uma camada.
 *
 * REGRA ESPECIAL — dropdowns DENTRO do header sticky:
 *   Por default, o componente shadcn DropdownMenu/Popover/Select usa z-index `dropdown` (999),
 *   que fica ABAIXO do header (1000). Isso é correto pra dropdowns em listagens/cards.
 *
 *   Mas se você abrir um dropdown a partir de um trigger que está VISUALMENTE DENTRO do header
 *   sticky (ex: o seletor de apps, settings dropdown, notification bell), precisa elevar pra
 *   `headerDropdown` (1500) — caso contrário o header engole o dropdown.
 *
 *   Como aplicar: `<DropdownMenuContent style={{ zIndex: Z_INDEX.headerDropdown }}>`.
 *
 * TOOLTIPS — o componente `ui/tooltip.tsx` já aplica `Z_INDEX.tooltip` (5000) via style inline,
 *   garantindo que apareçam acima do header (1000), modais (2000), toasts (3000) e qualquer
 *   chrome sticky. Não precisa configurar z-index ao usar `<TooltipContent>` — o default
 *   funciona em qualquer contexto exceto AlertDialog (alert: 10000).
 *
 * Z-index em CSS (`.leaflet-tooltip` etc.) e em controles de mapas Leaflet (z-[1000] em
 * MapDrawingTool, SamplingMapPicker, AnnotationMapPicker, MapView, MapLayerSelector,
 * ClimaticMapTab) são ISOLADOS em seu próprio stacking context (.leaflet-container z-1)
 * e portanto não conflitam com este sistema. Não precisam ser migrados.
 */
export const Z_INDEX = {
  /** Conteúdo padrão da página */
  base: 0,
  /** Controles flutuantes sobre mapas Leaflet (botões de zoom, layer picker, etc.) */
  mapControls: 100,
  /** Dropdown/Popover/Select padrão — abaixo do header em scroll, acima de cards */
  dropdown: 999,
  /** Header sticky principal — acima de dropdowns regulares pra não ser invadido */
  header: 1000,
  /** Dropdowns que abrem DENTRO do header (App Selector, etc.) — acima do header */
  headerDropdown: 1500,
  /** Overlay escuro de modais */
  modalOverlay: 1900,
  /** Dialog, Sheet — modais full-screen que cobrem o header */
  modal: 2000,
  /** Dropdowns DENTRO de modais — acima do modal */
  modalDropdown: 2500,
  /** Notificações flutuantes (Toast/Sonner) */
  toast: 3000,
  /** Tooltip — UI auxiliar momentânea (hover/long-press), acima de toast e qualquer chrome */
  tooltip: 5000,
  /** AlertDialog — máxima prioridade, ações irreversíveis */
  alert: 10000,
} as const;

export type ZIndexToken = keyof typeof Z_INDEX;

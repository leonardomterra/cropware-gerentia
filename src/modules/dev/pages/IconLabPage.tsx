import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";

// Offline / producao: import estatico via unplugin-icons (tree-shaken, sem rede).
// E' assim que os icones devem entrar nas telas reais do app.
import MsReceipt from "~icons/material-symbols-light/receipt-long-outline";
import MsWallet from "~icons/material-symbols-light/account-balance-wallet-outline";
import MsSettings from "~icons/material-symbols-light/settings-outline";
import MsChart from "~icons/material-symbols-light/bar-chart-4-bars";
import SpinRing from "~icons/svg-spinners/ring-resize";
import LineConfirm from "~icons/line-md/confirm-circle";

/**
 * Tela de laboratorio de icones (DEV / nao-producao).
 * Acessivel em /icones. Compara o lucide atual com sets do Iconify:
 * mdi-light, material-symbols-light, line-md (animado) e svg-spinners.
 * Iconify carrega os SVGs pela API (api.iconify.design) sob demanda -
 * precisa de internet. Em producao, instalar os bundles offline
 * (`@iconify-json/mdi-light` etc.) pra nao depender de rede.
 */

// Conceitos que TODOS os 4 sets cobrem - comparacao limpa de estilo.
const COMMON = [
  { label: "Inicio", lucide: "lucide:house", mdi: "mdi-light:home", ms: "material-symbols-light:home-outline", line: "line-md:home" },
  { label: "Config", lucide: "lucide:settings", mdi: "mdi-light:cog", ms: "material-symbols-light:settings-outline", line: "line-md:cog-loop" },
  { label: "Alertas", lucide: "lucide:bell", mdi: "mdi-light:bell", ms: "material-symbols-light:notifications-outline", line: "line-md:bell-loop" },
  { label: "Buscar", lucide: "lucide:search", mdi: "mdi-light:magnify", ms: "material-symbols-light:search", line: "line-md:search" },
  { label: "Editar", lucide: "lucide:pencil", mdi: "mdi-light:pencil", ms: "material-symbols-light:edit-outline", line: "line-md:edit" },
  { label: "Excluir", lucide: "lucide:trash-2", mdi: "mdi-light:delete", ms: "material-symbols-light:delete-outline", line: "line-md:trash" },
  { label: "Data", lucide: "lucide:calendar", mdi: "mdi-light:calendar", ms: "material-symbols-light:calendar-month-outline", line: "line-md:calendar" },
  { label: "Foto", lucide: "lucide:camera", mdi: "mdi-light:camera", ms: "material-symbols-light:photo-camera-outline", line: "line-md:image" },
];

// Conceitos do Farm - mdi-light (set pequeno ~250) costuma NAO ter,
// material-symbols-light (~3000) cobre. Mostra o tradeoff de cobertura.
const FARM = [
  { label: "Recibo", lucide: "lucide:receipt", mdi: "mdi-light:file-document", ms: "material-symbols-light:receipt-long-outline" },
  { label: "Carteira", lucide: "lucide:wallet", mdi: "mdi-light:wallet", ms: "material-symbols-light:account-balance-wallet-outline" },
  { label: "Grafico", lucide: "lucide:bar-chart-3", mdi: "mdi-light:chart-line", ms: "material-symbols-light:bar-chart-4-bars" },
  { label: "Fazenda", lucide: "lucide:sprout", mdi: "mdi-light:leaf", ms: "material-symbols-light:agriculture-outline" },
  { label: "Equipe", lucide: "lucide:users", mdi: "mdi-light:account", ms: "material-symbols-light:group-outline" },
  { label: "Recorrente", lucide: "lucide:repeat", mdi: "mdi-light:refresh", ms: "material-symbols-light:autorenew" },
];

// line-md - icones com animacao SVG embutida. Alguns animam 1x ao montar
// (draw), outros em loop. O botao Replay remonta a secao pra ver de novo.
const ANIMATED = [
  { label: "confirm-circle", icon: "line-md:confirm-circle" },
  { label: "check-all", icon: "line-md:check-all" },
  { label: "bell-loop", icon: "line-md:bell-loop" },
  { label: "cog-loop", icon: "line-md:cog-loop" },
  { label: "loading-loop", icon: "line-md:loading-loop" },
  { label: "downloading-loop", icon: "line-md:downloading-loop" },
  { label: "alert-circle", icon: "line-md:alert-circle" },
  { label: "heart", icon: "line-md:heart-filled" },
];

// svg-spinners - so loaders, animam sozinhos (zero JS).
const SPINNERS = [
  "svg-spinners:3-dots-fade",
  "svg-spinners:ring-resize",
  "svg-spinners:90-ring-with-bg",
  "svg-spinners:bars-scale",
  "svg-spinners:pulse-3",
  "svg-spinners:bouncing-ball",
  "svg-spinners:tadpole",
  "svg-spinners:180-ring",
  "svg-spinners:gooey-balls-1",
  "svg-spinners:dot-revolve",
];

function IconCell({ icon, caption }: { icon?: string; caption: string }) {
  return (
    <div className="flex flex-col items-center justify-start gap-1.5 w-16">
      <div className="h-7 flex items-center justify-center text-slate-700">
        {icon ? <Icon icon={icon} className="size-7" /> : <span className="text-xs text-slate-300">-</span>}
      </div>
      <span className="text-xs text-slate-400 text-center leading-tight">{caption}</span>
    </div>
  );
}

export default function IconLabPage() {
  const [replay, setReplay] = useState(0);

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-base font-medium text-slate-900">Laboratório de Ícones</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Comparativo via Iconify (carrega da API, so dev). Tudo em slate-700, tamanhos do app.
        </p>
      </header>

      {/* A - mesmo conceito, 4 estilos */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-xs font-medium text-slate-500 tracking-wide mb-4">
          Mesmo icone, 4 estilos (lucide atual x mdi-light x material-symbols-light x line-md)
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_repeat(4,1fr)] items-center text-xs text-slate-400 pb-2 border-b border-slate-100">
            <span></span>
            <span className="text-center">lucide</span>
            <span className="text-center">mdi-light</span>
            <span className="text-center">material-symbols-light</span>
            <span className="text-center">line-md</span>
          </div>
          {COMMON.map((row) => (
            <div key={row.label} className="grid grid-cols-[80px_repeat(4,1fr)] items-center">
              <span className="text-sm text-slate-600">{row.label}</span>
              <div className="flex justify-center"><Icon icon={row.lucide} className="size-7 text-slate-700" /></div>
              <div className="flex justify-center"><Icon icon={row.mdi} className="size-7 text-slate-700" /></div>
              <div className="flex justify-center"><Icon icon={row.ms} className="size-7 text-slate-700" /></div>
              <div className="flex justify-center"><Icon icon={row.line} className="size-7 text-slate-700" /></div>
            </div>
          ))}
        </div>
      </section>

      {/* B - cobertura nos conceitos do Farm */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-xs font-medium text-slate-500 tracking-wide mb-1">
          Cobertura: conceitos do Farm
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Celula vazia (-) = o set nao tem esse icone. Repare como o mdi-light (set pequeno) falha em varios.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-[90px_repeat(3,1fr)] items-center text-xs text-slate-400 pb-2 border-b border-slate-100">
            <span></span>
            <span className="text-center">lucide</span>
            <span className="text-center">mdi-light</span>
            <span className="text-center">material-symbols-light</span>
          </div>
          {FARM.map((row) => (
            <div key={row.label} className="grid grid-cols-[90px_repeat(3,1fr)] items-center">
              <span className="text-sm text-slate-600">{row.label}</span>
              <div className="flex justify-center"><Icon icon={row.lucide} className="size-7 text-slate-700" /></div>
              <div className="flex justify-center"><Icon icon={row.mdi} className="size-7 text-slate-700" /></div>
              <div className="flex justify-center"><Icon icon={row.ms} className="size-7 text-slate-700" /></div>
            </div>
          ))}
        </div>
      </section>

      {/* C - animados line-md */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-slate-500 tracking-wide">
            Animados (line-md) - alguns animam 1x ao aparecer
          </h2>
          <Button variant="outline" onClick={() => setReplay((n) => n + 1)}>
            Replay
          </Button>
        </div>
        <div key={replay} className="flex flex-wrap gap-x-2 gap-y-5">
          {ANIMATED.map((a) => (
            <IconCell key={a.label} icon={a.icon} caption={a.label} />
          ))}
        </div>
      </section>

      {/* D - svg-spinners */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-xs font-medium text-slate-500 tracking-wide mb-4">
          Spinners (svg-spinners) - loaders, animam sozinhos
        </h2>
        <div className="flex flex-wrap gap-x-2 gap-y-5">
          {SPINNERS.map((s) => (
            <IconCell key={s} icon={s} caption={s.replace("svg-spinners:", "")} />
          ))}
        </div>
      </section>

      {/* E - em contexto */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-xs font-medium text-slate-500 tracking-wide mb-4">
          Em contexto
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          {/* botao carregando */}
          <Button disabled>
            <Icon icon="svg-spinners:ring-resize" className="size-4 mr-2" />
            Salvando...
          </Button>

          {/* sucesso */}
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5">
            <Icon icon="line-md:confirm-circle" className="size-4" />
            Lancamento salvo
          </div>

          {/* alerta */}
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-1.5">
            <Icon icon="line-md:alert-circle" className="size-4" />
            Conta vencida
          </div>
        </div>
      </section>

      {/* F - offline / producao (unplugin-icons) */}
      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-xs font-medium text-slate-500 tracking-wide mb-1">
          Offline (unplugin-icons) - jeito de PRODUCAO
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Import estatico de "~icons/SET/NOME" (ex: ~icons/material-symbols-light/receipt-long-outline).
          Tree-shaken, sem rede - so o icone usado entra no bundle. As secoes acima usam a API (so dev).
        </p>
        <div className="flex flex-wrap items-center gap-6 text-slate-700">
          <MsReceipt className="size-7" />
          <MsWallet className="size-7" />
          <MsSettings className="size-7" />
          <MsChart className="size-7" />
          <SpinRing className="size-7" />
          <LineConfirm className="size-7" />
        </div>
      </section>
    </div>
  );
}

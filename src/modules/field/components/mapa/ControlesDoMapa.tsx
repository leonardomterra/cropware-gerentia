import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import Stack from "~icons/ph/stack";
import Crosshair from "~icons/ph/crosshair";
import MagnifyingGlass from "~icons/ph/magnifying-glass";
import { cn } from "@/components/ui/utils";
import { CAMADAS, type CamadaDoMapa } from "../../geo/leaflet";
import { buscarLugar } from "../../geo/geocodificar";
import type { LatLng } from "../../geo/geometria";
import { posicaoAtual } from "@/utils/geolocalizacao";

/**
 * Botões que flutuam sobre o mapa. Sempre `type="button"`: eles vivem dentro do
 * formulário do cadastro, e um botão sem tipo seria submit. No modo leitura o
 * <fieldset disabled> da PaginaDeFormulario os desliga junto com o resto — o
 * mapa continua navegável com o dedo/mouse.
 */
export function BotaoDoMapa({
  rotulo,
  onClick,
  ativo,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  ativo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      className={cn(
        "size-9 inline-flex items-center justify-center rounded-md shadow-md border transition-colors",
        ativo
          ? "bg-slate-800 text-white border-slate-800"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

/** Alterna satélite ↔ mapa. */
export function SeletorDeCamada({
  camada,
  aoTrocar,
}: {
  camada: CamadaDoMapa["id"];
  aoTrocar: (c: CamadaDoMapa["id"]) => void;
}) {
  const outra = CAMADAS.find((c) => c.id !== camada) ?? CAMADAS[0];
  return (
    <BotaoDoMapa
      rotulo={`Mostrar ${outra.nome.toLowerCase()}`}
      onClick={() => aoTrocar(outra.id)}
    >
      <Stack className="size-5" />
    </BotaoDoMapa>
  );
}

/** Centraliza na posição do aparelho. */
export function BotaoGps({ aoAchar }: { aoAchar: (p: LatLng) => void }) {
  const [buscando, setBuscando] = useState(false);
  return (
    <BotaoDoMapa
      rotulo="Minha localização"
      onClick={async () => {
        setBuscando(true);
        try {
          const p = await posicaoAtual();
          aoAchar([p.latitude, p.longitude]);
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Localização indisponível.",
          );
        } finally {
          setBuscando(false);
        }
      }}
    >
      <Crosshair className={cn("size-5", buscando && "animate-pulse")} />
    </BotaoDoMapa>
  );
}

/**
 * Busca de lugar ou coordenada. É um <div> e não um <form>: ela vive DENTRO do
 * formulário do cadastro, e form dentro de form não existe — o Enter daqui
 * submeteria o cadastro inteiro.
 */
export function BuscaNoMapa({ aoAchar }: { aoAchar: (p: LatLng) => void }) {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);

  async function buscar(e?: FormEvent) {
    e?.preventDefault();
    if (!texto.trim()) return;
    setBuscando(true);
    try {
      const p = await buscarLugar(texto);
      if (p) aoAchar(p);
      else
        toast.error(
          "Lugar não encontrado. Tente o nome da cidade ou uma coordenada.",
        );
    } catch {
      toast.error("Falha na busca. Confira a conexão.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex items-center gap-1 bg-white rounded-md shadow-md border border-slate-200 pl-2 h-9 w-full max-w-xs">
      <MagnifyingGlass className="size-4 text-slate-400 shrink-0" />
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void buscar();
          }
        }}
        placeholder="Cidade ou -17.79, -50.92"
        className="flex-1 min-w-0 text-sm bg-transparent outline-none"
        aria-label="Buscar lugar no mapa"
      />
      <button
        type="button"
        onClick={() => void buscar()}
        disabled={buscando}
        className="h-full px-3 text-sm text-slate-600 hover:bg-slate-50 rounded-r-md disabled:opacity-50"
      >
        {buscando ? "..." : "Ir"}
      </button>
    </div>
  );
}

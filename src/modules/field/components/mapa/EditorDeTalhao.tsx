import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Polygon from "~icons/ph/polygon";
import CircleIcon from "~icons/ph/circle-dashed";
import MapPin from "~icons/ph/map-pin";
import Upload from "~icons/ph/upload-simple";
import Undo from "~icons/ph/arrow-u-up-left";
import Trash from "~icons/ph/trash";
import Check from "~icons/ph/check";
import ArrowLeft from "~icons/ph/arrow-left";
import Barn from "~icons/ph/barn";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA } from "@/lib/ui-tokens";
import { L } from "../../geo/leaflet";
import {
  areaHa,
  caixaDe,
  formatarArea,
  formatarDistancia,
  perimetroM,
  pivoParaPoligono,
  pontoDoRotulo,
  seAutoIntercepta,
  distanciaM,
  type LatLng,
} from "../../geo/geometria";
import {
  EXTENSOES_ACEITAS,
  ErroDeImportacao,
  importarArquivoDeContorno,
} from "../../geo/importarGeometria";
import { useMapaLeaflet } from "./useMapaLeaflet";
import {
  BotaoDoMapa,
  BotaoGps,
  BuscaNoMapa,
  SeletorDeCamada,
} from "./ControlesDoMapa";

type Modo = "ocioso" | "poligono" | "pivo" | "marcador" | "editar";

export interface Vizinho {
  nome: string;
  pontos: LatLng[];
}

/** Distância em PIXELS de tela para fechar o polígono no 1º vértice. */
const RAIO_DE_FECHAR_PX = 16;
const COR = "#facc15"; // amarelo: lê bem sobre o verde e o marrom do satélite

const icone = (classe: string, tamanho: number) =>
  L.divIcon({
    className: "",
    html: `<div class="${classe}" style="width:${tamanho}px;height:${tamanho}px"></div>`,
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
  });
const ICONE_VERTICE = icone(
  "rounded-full bg-white border-2 border-yellow-400 shadow",
  14,
);
const ICONE_VERTICE_SELECIONADO = icone(
  "rounded-full bg-red-500 border-2 border-white shadow",
  16,
);
const ICONE_MEIO = icone(
  "rounded-full bg-yellow-300/70 border border-white",
  10,
);

/**
 * Editor do contorno de um talhão — página inteira, com Voltar/Aplicar.
 *
 * Refeito a partir do MapDrawingToolAdvanced do Flag Field (2.360 linhas), com a
 * mesma lógica e bem menos estado: o desenho é UM array `pontos` ([lat,lng],
 * anel aberto) e o mapa é redesenhado a partir dele. Modos:
 *   - Polígono: cada toque é um vértice; tocar no 1º fecha.
 *   - Pivô: 1º toque o centro, 2º o raio → polígono de 36 vértices.
 *   - Marcador: um ponto; a área é digitada no formulário.
 *   - Editar: arrastar vértice; arrastar o ponto do meio da aresta cria vértice;
 *     tocar num vértice o seleciona para remover.
 * Ficaram para depois (plano da fase 1): snap nos vizinhos, toque longo,
 * atalhos de teclado.
 */
export function EditorDeTalhao({
  inicial,
  vizinhos,
  sede,
  aoAplicar,
  aoVoltar,
}: {
  inicial: LatLng[];
  vizinhos: Vizinho[];
  sede: LatLng | null;
  aoAplicar: (pontos: LatLng[]) => void;
  aoVoltar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { mapa, camada, setCamada } = useMapaLeaflet(ref);
  const [pontos, setPontos] = useState<LatLng[]>(inicial);
  const [modo, setModo] = useState<Modo>(inicial.length ? "editar" : "ocioso");
  // Cada passo guarda pontos E modo: desfazer o "fechar" reabre o polígono.
  const [historico, setHistorico] = useState<
    { pontos: LatLng[]; modo: Modo }[]
  >([]);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  // Refs para os handlers do Leaflet enxergarem o valor atual sem recriar o mapa.
  const estado = useRef({ pontos, modo });
  estado.current = { pontos, modo };

  function mudar(novos: LatLng[], novoModo?: Modo) {
    setHistorico((h) => [...h.slice(-30), { ...estado.current }]);
    setPontos(novos);
    if (novoModo) setModo(novoModo);
    setSelecionado(null);
  }

  // Enquadramento inicial: o talhão, senão os vizinhos, senão a sede.
  const enquadrou = useRef(false);
  useEffect(() => {
    if (!mapa || enquadrou.current) return;
    enquadrou.current = true;
    const caixa = caixaDe(
      inicial.length ? [inicial] : vizinhos.map((v) => v.pontos),
    );
    if (caixa) mapa.fitBounds(caixa, { padding: [40, 40], maxZoom: 17 });
    else if (sede) mapa.setView(sede, 15);
  }, [mapa, inicial, vizinhos, sede]);

  // Vizinhos (os outros talhões da fazenda) em branco, com o nome.
  useEffect(() => {
    if (!mapa) return;
    const g = L.layerGroup().addTo(mapa);
    for (const v of vizinhos) {
      if (v.pontos.length >= 3) {
        L.polygon(v.pontos, {
          pane: "vizinhos",
          color: "#ffffff",
          weight: 1.5,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(g);
        L.tooltip({
          permanent: true,
          direction: "center",
          className: "rotulo-do-talhao",
        })
          .setLatLng(pontoDoRotulo(v.pontos))
          .setContent(v.nome)
          .addTo(g);
      }
    }
    if (sede) L.marker(sede, { interactive: false }).addTo(g);
    return () => {
      g.remove();
    };
  }, [mapa, vizinhos, sede]);

  // O desenho atual + vértices editáveis.
  useEffect(() => {
    if (!mapa) return;
    const g = L.layerGroup().addTo(mapa);
    const fechado = modo === "editar" && pontos.length >= 3;

    if (pontos.length === 1 && (modo === "marcador" || modo === "editar")) {
      const m = L.marker(pontos[0], { draggable: true }).addTo(g);
      m.on("dragend", () => {
        const p = m.getLatLng();
        mudar([[p.lat, p.lng]]);
      });
    } else if (pontos.length > 0) {
      const forma = fechado
        ? L.polygon(pontos, {
            pane: "desenho",
            color: COR,
            weight: 2.5,
            fillOpacity: 0.2,
          })
        : L.polyline(pontos, {
            pane: "desenho",
            color: COR,
            weight: 2.5,
            dashArray: "6 6",
          });
      forma.addTo(g);

      pontos.forEach((p, i) => {
        const v = L.marker(p, {
          pane: "vertices",
          icon: i === selecionado ? ICONE_VERTICE_SELECIONADO : ICONE_VERTICE,
          draggable: fechado,
          // Leaflet não deixa o clique no vértice passar para o mapa.
          bubblingMouseEvents: false,
        }).addTo(g);
        v.on("click", () => {
          if (modo === "poligono" && i === 0 && pontos.length >= 3) {
            mudar(pontos, "editar"); // fechou no 1º vértice
          } else if (fechado) {
            setSelecionado((s) => (s === i ? null : i));
          }
        });
        if (fechado) {
          // Durante o arraste só a forma acompanha (sem setState a cada pixel);
          // o estado muda no fim.
          v.on("drag", () => {
            const vivos = [...estado.current.pontos];
            const q = v.getLatLng();
            vivos[i] = [q.lat, q.lng];
            (forma as L.Polygon).setLatLngs(vivos);
          });
          v.on("dragend", () => {
            const q = v.getLatLng();
            const novos = [...estado.current.pontos];
            novos[i] = [q.lat, q.lng];
            mudar(novos);
          });
        }
      });

      if (fechado) {
        // Ponto do meio de cada aresta: arrastar cria um vértice novo ali.
        pontos.forEach((p, i) => {
          const q = pontos[(i + 1) % pontos.length];
          const meio: LatLng = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          const h = L.marker(meio, {
            pane: "vertices",
            icon: ICONE_MEIO,
            draggable: true,
            bubblingMouseEvents: false,
          }).addTo(g);
          h.on("dragend", () => {
            const r = h.getLatLng();
            const novos = [...estado.current.pontos];
            novos.splice(i + 1, 0, [r.lat, r.lng]);
            mudar(novos);
          });
        });
      }
    }
    return () => {
      g.remove();
    };
     
  }, [mapa, pontos, modo, selecionado]);

  // Cliques no mapa conforme o modo.
  useEffect(() => {
    if (!mapa) return;
    const aoClicar = (e: L.LeafletMouseEvent) => {
      const p: LatLng = [e.latlng.lat, e.latlng.lng];
      const { pontos: atuais, modo: m } = estado.current;
      if (m === "poligono") {
        // Tocar perto do 1º vértice fecha (em pixels, para valer em qualquer zoom).
        if (atuais.length >= 3) {
          const a = mapa.latLngToContainerPoint(atuais[0]);
          if (a.distanceTo(e.containerPoint) < RAIO_DE_FECHAR_PX) {
            mudar(atuais, "editar");
            return;
          }
        }
        mudar([...atuais, p]);
      } else if (m === "pivo") {
        if (atuais.length === 0) mudar([p]);
        else {
          const raio = distanciaM(atuais[0], p);
          if (raio < 5) return;
          mudar(pivoParaPoligono(atuais[0], raio), "editar");
        }
      } else if (m === "marcador") {
        mudar([p], "editar");
      } else {
        setSelecionado(null);
      }
    };
    mapa.on("click", aoClicar);
    const desenhando =
      modo === "poligono" || modo === "pivo" || modo === "marcador";
    mapa.getContainer().style.cursor = desenhando ? "crosshair" : "";
    return () => {
      mapa.off("click", aoClicar);
    };
     
  }, [mapa, modo]);

  function comecar(m: Modo) {
    if (pontos.length > 0) mudar([], m);
    else setModo(m);
  }

  function desfazer() {
    if (historico.length === 0) return;
    const anterior = historico[historico.length - 1];
    setHistorico(historico.slice(0, -1));
    setPontos(anterior.pontos);
    setModo(anterior.pontos.length === 0 ? "ocioso" : anterior.modo);
    setSelecionado(null);
  }

  function removerSelecionado() {
    if (selecionado == null) return;
    if (pontos.length <= 3) {
      toast.error("O talhão precisa de pelo menos 3 vértices.");
      return;
    }
    mudar(pontos.filter((_, i) => i !== selecionado));
  }

  async function importar(arquivo: File) {
    try {
      const pts = await importarArquivoDeContorno(arquivo);
      mudar(pts, "editar");
      const caixa = caixaDe([pts]);
      if (caixa && mapa)
        mapa.fitBounds(caixa, { padding: [40, 40], maxZoom: 17 });
      toast.success(`Contorno importado (${pts.length} vértices).`);
    } catch (e) {
      toast.error(
        e instanceof ErroDeImportacao
          ? e.message
          : "Não foi possível ler o arquivo.",
      );
    }
  }

  const ehPoligono = pontos.length >= 3;
  const area = useMemo(
    () => (ehPoligono ? areaHa(pontos) : 0),
    [ehPoligono, pontos],
  );
  const perimetro = useMemo(
    () => (ehPoligono ? perimetroM(pontos) : 0),
    [ehPoligono, pontos],
  );

  function aplicar() {
    if (pontos.length === 1) {
      aoAplicar(pontos);
      return;
    }
    if (pontos.length < 3) {
      toast.error(
        "Desenhe o contorno (3 vértices ou mais) ou marque um ponto.",
      );
      return;
    }
    if (modo === "poligono") {
      toast.error("Feche o polígono tocando no primeiro vértice.");
      return;
    }
    if (seAutoIntercepta(pontos)) {
      toast.error(
        "O contorno se cruza. Arraste os vértices para desfazer o cruzamento.",
      );
      return;
    }
    if (!(area > 0)) {
      toast.error("A área do desenho ficou zerada.");
      return;
    }
    aoAplicar(pontos);
  }

  const dica: Record<Modo, string> = {
    ocioso: "Escolha como desenhar o talhão, ou importe um KML/KMZ.",
    poligono:
      pontos.length < 3
        ? "Toque no mapa para marcar cada canto do talhão."
        : "Continue marcando, ou toque no primeiro ponto para fechar.",
    pivo:
      pontos.length === 0
        ? "Toque no centro do pivô."
        : "Agora toque na borda do pivô.",
    marcador: "Toque onde fica o talhão. A área você informa no formulário.",
    editar:
      pontos.length === 1
        ? "Arraste o marcador para ajustar."
        : "Arraste os vértices para ajustar. Arraste um ponto do meio para criar vértice; toque num vértice para removê-lo.",
  };

  const ferramenta = (m: Modo, rotulo: string, Icon: typeof Polygon) => (
    <button
      key={m}
      type="button"
      onClick={() => comecar(m)}
      className={cn(
        "h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-sm transition-colors",
        modo === m
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200",
      )}
    >
      <Icon className="size-4" />
      {rotulo}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={aoVoltar}
          className={cn(BOTAO_BARRA, "rounded-md")}
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar
        </Button>
        <Button
          type="button"
          onClick={aplicar}
          className="h-9 px-5 font-normal shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Check className="size-4 mr-2" />
          Aplicar desenho
        </Button>
        {ehPoligono && modo === "editar" && (
          <span className="text-sm text-slate-600 tabular-nums">
            <strong className="font-medium text-slate-900">
              {formatarArea(area)}
            </strong>
            {" · perímetro "}
            {formatarDistancia(perimetro)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ferramenta("poligono", "Polígono", Polygon)}
        {ferramenta("pivo", "Pivô", CircleIcon)}
        {ferramenta("marcador", "Marcador", MapPin)}
        <button
          type="button"
          onClick={() => arquivoRef.current?.click()}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
        >
          <Upload className="size-4" />
          Importar KML/KMZ
        </button>
        <input
          ref={arquivoRef}
          type="file"
          accept={EXTENSOES_ACEITAS}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importar(f);
          }}
        />
        <div className="flex gap-2 ml-auto">
          {selecionado != null && (
            <button
              type="button"
              onClick={removerSelecionado}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-sm bg-red-50 text-red-700 hover:bg-red-100"
            >
              <Trash className="size-4" />
              Remover vértice
            </button>
          )}
          <button
            type="button"
            onClick={desfazer}
            disabled={historico.length === 0}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          >
            <Undo className="size-4" />
            Desfazer
          </button>
          {pontos.length > 0 && (
            <button
              type="button"
              onClick={() => mudar([], "ocioso")}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <Trash className="size-4" />
              Limpar
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-500">{dica[modo]}</p>

      <div className="relative rounded-lg overflow-hidden border border-slate-200">
        <div
          ref={ref}
          className="w-full bg-slate-100"
          style={{ height: "min(70dvh, 640px)" }}
        />
        <div className="absolute top-2 left-12 right-14 z-[1000]">
          <BuscaNoMapa aoAchar={(p) => mapa?.setView(p, 15)} />
        </div>
        <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1.5">
          <SeletorDeCamada camada={camada} aoTrocar={setCamada} />
          <BotaoGps aoAchar={(p) => mapa?.setView(p, 17)} />
          {sede && (
            <BotaoDoMapa
              rotulo="Ir para a sede"
              onClick={() => mapa?.setView(sede, 15)}
            >
              <Barn className="size-5" />
            </BotaoDoMapa>
          )}
        </div>
      </div>
    </div>
  );
}

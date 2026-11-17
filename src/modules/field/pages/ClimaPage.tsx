import { useMemo, useState } from "react";
import { toast } from "sonner";
import CloudSun from "~icons/ph/cloud-sun-duotone";
import Crosshair from "~icons/ph/crosshair";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { posicaoAtual } from "@/utils/geolocalizacao";
import { useCadastros } from "../hooks/useCadastros";
import { localDaFazenda, useClima } from "../hooks/useClima";
import { PrevisaoDaSemana, ResumoDoClima } from "../components/ClimaDoCampo";
import { REGRAS_DE_APLICACAO } from "../dominio/clima";
import type { LatLng } from "../geo/geometria";

/**
 * Clima da fazenda (fase 5) — agora, 7 dias e a janela de aplicação, pelo
 * Open-Meteo. Local: a sede da fazenda (ou o meio do 1º talhão), ou o GPS.
 */
export default function ClimaPage() {
  const c = useCadastros();
  const comLocal = useMemo(
    () => c.fazendas.filter((f) => localDaFazenda(f, c.talhoes)),
    [c.fazendas, c.talhoes],
  );
  const [farmId, setFarmId] = useState("");
  const [gps, setGps] = useState<LatLng | null>(null);
  const fazenda = comLocal.find((f) => f.id === farmId) ?? comLocal[0] ?? null;
  const local = gps ?? (fazenda ? localDaFazenda(fazenda, c.talhoes) : null);
  const { clima, erro, carregando } = useClima(local);
  const r = REGRAS_DE_APLICACAO;

  if (c.carregando) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="sm:w-72">
          <SearchableSelect
            options={comLocal.map((f) => ({ value: f.id, label: f.name }))}
            value={gps ? "" : (fazenda?.id ?? "")}
            onValueChange={(v) => {
              setGps(null);
              setFarmId(v);
            }}
            placeholder="Escolha a fazenda"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            try {
              const p = await posicaoAtual();
              setGps([p.latitude, p.longitude]);
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Localização indisponível.",
              );
            }
          }}
        >
          <Crosshair className="size-4 mr-1.5" />
          Onde estou
        </Button>
        {gps && (
          <span className="text-xs text-slate-500">
            Mostrando a sua localização atual.
          </span>
        )}
      </div>

      {!local ? (
        <EmptyStateCard
          icon={CloudSun}
          title="Sem local para o clima"
          description="Marque a sede da fazenda (Field → Fazendas) ou desenhe um talhão — ou use 'Onde estou'."
        />
      ) : carregando && !clima ? (
        <LoadingState />
      ) : erro ? (
        <p className="text-sm text-red-700">{erro}</p>
      ) : clima ? (
        <>
          <ResumoDoClima clima={clima} />
          <PrevisaoDaSemana clima={clima} />
          <p className="text-xs text-slate-400">
            Janela de aplicação: rejeita vento acima de {r.ventoRejeita} km/h e
            chuva na hora ou nas 2 seguintes; desconta vento entre{" "}
            {r.ventoAtencao} e {r.ventoRejeita} km/h, calmaria abaixo de{" "}
            {r.ventoCalmaria} km/h, umidade abaixo de {r.umidadeBaixa}% ou acima
            de {r.umidadeAlta}%, calor a partir de {r.temperaturaAlta} °C e o
            horário das 11h às 15h. Previsão: Open-Meteo.
          </p>
        </>
      ) : null}
    </div>
  );
}

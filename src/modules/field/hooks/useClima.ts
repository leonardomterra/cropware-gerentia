import { useEffect, useState } from "react";
import type { HoraDoClima } from "../dominio/clima";
import {
  gddAcumulado,
  juntarSeries,
  tbaseDa,
  type DiaDeTemperatura,
} from "../dominio/gdd";
import { deGeoJson, pontoDoRotulo, type LatLng } from "../geo/geometria";
import type { Fazenda, Talhao } from "../types";

/**
 * Clima pelo Open-Meteo, DIRETO do navegador (sem chave e sem servidor — como
 * o GDD do Flag Field já fazia). Vento em km/h, que é o padrão da API: o Flag
 * Field multiplicava por 3,6 de novo e mostrava vento 3,6× maior.
 */
export interface DiaDoClima {
  data: string;
  codigo: number;
  max: number;
  min: number;
  chuvaProb: number;
  chuvaMm: number;
  ventoMax: number;
  uv: number;
}
export interface Clima {
  /** Hora local da fazenda ("aaaa-mm-ddTHH:MM"). */
  agora: string;
  atual: {
    temperatura: number;
    sensacao: number;
    umidade: number;
    vento: number;
    direcao: number;
    codigo: number;
  };
  horas: HoraDoClima[];
  dias: DiaDoClima[];
}

/** Onde medir: a sede da fazenda; sem sede, o meio do 1º talhão desenhado. */
export function localDaFazenda(f: Fazenda, talhoes: Talhao[]): LatLng | null {
  if (f.latitude != null && f.longitude != null)
    return [f.latitude, f.longitude];
  const t = talhoes.find((x) => x.farm_id === f.id && x.geometry);
  const pts = deGeoJson(t?.geometry);
  if (pts.length === 1) return pts[0];
  if (pts.length >= 3) return pontoDoRotulo(pts);
  return null;
}

const cacheDoClima = new Map<string, { quando: number; clima: Clima }>();

export async function buscarClima([lat, lng]: LatLng): Promise<Clima> {
  const chave = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cacheDoClima.get(chave);
  if (hit && Date.now() - hit.quando < 30 * 60e3) return hit.clima;
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m",
    hourly:
      "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max",
    timezone: "auto",
    forecast_days: "7",
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
  if (!r.ok) throw new Error(`open-meteo ${r.status}`);
  const j = await r.json();
  const h = j.hourly;
  const d = j.daily;
  const clima: Clima = {
    agora: j.current.time,
    atual: {
      temperatura: j.current.temperature_2m,
      sensacao: j.current.apparent_temperature,
      umidade: j.current.relative_humidity_2m,
      vento: j.current.wind_speed_10m,
      direcao: j.current.wind_direction_10m,
      codigo: j.current.weather_code,
    },
    horas: (h.time as string[]).slice(0, 72).map((t, i) => ({
      hora: t,
      temperatura: h.temperature_2m[i],
      umidade: h.relative_humidity_2m[i],
      vento: h.wind_speed_10m[i],
      chuvaProb: h.precipitation_probability[i] ?? 0,
      chuvaMm: h.precipitation[i] ?? 0,
    })),
    dias: (d.time as string[]).map((t, i) => ({
      data: t,
      codigo: d.weather_code[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      chuvaProb: d.precipitation_probability_max[i] ?? 0,
      chuvaMm: d.precipitation_sum[i] ?? 0,
      ventoMax: d.wind_speed_10m_max[i],
      uv: d.uv_index_max[i],
    })),
  };
  cacheDoClima.set(chave, { quando: Date.now(), clima });
  return clima;
}

export function useClima(local: LatLng | null) {
  const [clima, setClima] = useState<Clima | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const chave = local ? `${local[0]},${local[1]}` : "";
  useEffect(() => {
    if (!local) return;
    let vivo = true;
    setCarregando(true);
    setErro(null);
    buscarClima(local)
      .then((c) => vivo && setClima(c))
      .catch(
        () => vivo && setErro("Não foi possível buscar a previsão do tempo."),
      )
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return { clima, erro, carregando };
}

/**
 * Temperaturas diárias desde `inicio` até hoje, para o GDD: o archive (que
 * atrasa ~5 dias) + o forecast com past_days para os dias recentes — o Flag
 * Field prometia isso no comentário e só usava o archive.
 */
export async function temperaturasDesde(
  [lat, lng]: LatLng,
  inicio: string,
): Promise<{ archive: DiaDeTemperatura[]; recente: DiaDeTemperatura[] }> {
  const hoje = new Date().toISOString().slice(0, 10);
  const ler = (j: {
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
    };
  }) =>
    (j.daily?.time ?? []).map((t, i) => ({
      data: t,
      max: j.daily!.temperature_2m_max[i],
      min: j.daily!.temperature_2m_min[i],
    }));
  const comum = `latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
  const [a, f] = await Promise.all([
    fetch(
      `https://archive-api.open-meteo.com/v1/archive?${comum}&start_date=${inicio}&end_date=${hoje}`,
    ).then((r) => (r.ok ? r.json() : {})),
    fetch(
      `https://api.open-meteo.com/v1/forecast?${comum}&past_days=10&forecast_days=1`,
    ).then((r) => (r.ok ? r.json() : {})),
  ]);
  return {
    archive: ler(a),
    recente: ler(f).filter((x) => x.data >= inicio && x.data <= hoje),
  };
}

/**
 * GDD de um plantio desde a data de plantio, com a temperatura-base da cultura
 * dele. `null` quando não há local, data ou a data é futura. O componente
 * GddDoPlantio e o relatório do plantio usam esta mesma função.
 */
export async function gddDoPlantio(
  plantio: { crop: string; planting_date: string | null },
  fazenda: Fazenda | null,
  talhoes: Talhao[],
): Promise<{ valor: number; tbase: number } | null> {
  const local = fazenda ? localDaFazenda(fazenda, talhoes) : null;
  const inicio = plantio.planting_date;
  if (!local || !inicio || inicio > new Date().toISOString().slice(0, 10))
    return null;
  const tbase = tbaseDa(plantio.crop);
  const { archive, recente } = await temperaturasDesde(local, inicio);
  return { valor: gddAcumulado(juntarSeries(archive, recente), tbase), tbase };
}

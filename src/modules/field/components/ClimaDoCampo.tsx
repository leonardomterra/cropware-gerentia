import { janelaDeAplicacao, rotuloDoTempo } from "../dominio/clima";
import type { Clima } from "../hooks/useClima";
import { cn } from "@/components/ui/utils";

const diaSemana = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
  });
const hora = (iso: string) => iso.slice(11, 16);
const quando = (iso: string, hoje: string) =>
  iso.slice(0, 10) === hoje
    ? `hoje ${hora(iso)}`
    : `${new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" })} ${hora(iso)}`;

/** "Agora" + as melhores horas para aplicar — usado na tela de Clima e no Dashboard. */
export function ResumoDoClima({
  clima,
  compacto,
}: {
  clima: Clima;
  compacto?: boolean;
}) {
  const janelas = janelaDeAplicacao(clima.horas, clima.agora, compacto ? 1 : 3);
  const hoje = clima.agora.slice(0, 10);
  return (
    <div
      className={cn(
        "grid gap-3",
        compacto ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 lg:grid-cols-2",
      )}
    >
      <div className="rounded-lg border border-slate-100 p-3">
        <p className="text-xs text-slate-500">
          Agora · {rotuloDoTempo(clima.atual.codigo)}
        </p>
        <p className="text-2xl font-medium text-slate-900 tabular-nums">
          {Math.round(clima.atual.temperatura)} °C
        </p>
        <p className="text-xs text-slate-500 tabular-nums">
          Umidade {Math.round(clima.atual.umidade)}% · vento{" "}
          {Math.round(clima.atual.vento)} km/h · sensação{" "}
          {Math.round(clima.atual.sensacao)} °C
        </p>
      </div>
      <div className="rounded-lg border border-slate-100 p-3">
        <p className="text-xs text-slate-500">Janela de aplicação</p>
        {janelas.length === 0 ? (
          <p className="text-sm text-slate-700 mt-1">
            Nenhuma hora boa nos próximos 3 dias (vento, chuva ou calor).
          </p>
        ) : (
          <ul className="space-y-1 mt-1">
            {janelas.map((j) => (
              <li key={j.hora} className="text-sm">
                <span className="font-medium text-slate-900 tabular-nums">
                  {quando(j.hora, hoje)}
                </span>
                <span
                  className={cn(
                    "ml-2 text-xs px-1.5 py-0.5 rounded",
                    j.nota >= 85
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700",
                  )}
                >
                  {j.nota}
                </span>
                {j.motivos.length > 0 && (
                  <span className="block text-xs text-slate-500">
                    {j.motivos.join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Os 7 dias. */
export function PrevisaoDaSemana({ clima }: { clima: Clima }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {clima.dias.map((d) => (
        <div
          key={d.data}
          className="rounded-lg border border-slate-200 bg-white p-2 text-center"
        >
          <p className="text-xs text-slate-500 capitalize">
            {diaSemana(d.data)}
          </p>
          <p className="text-xs text-slate-600">{rotuloDoTempo(d.codigo)}</p>
          <p className="text-sm font-medium text-slate-900 tabular-nums">
            {Math.round(d.max)}° / {Math.round(d.min)}°
          </p>
          <p className="text-xs text-blue-700 tabular-nums">
            {d.chuvaProb}% ·{" "}
            {d.chuvaMm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mm
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            vento até {Math.round(d.ventoMax)} km/h · UV {Math.round(d.uv)}
          </p>
        </div>
      ))}
    </div>
  );
}

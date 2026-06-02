/**
 * Breadcrumb da rota atual (ex: "Dashboard", ou "Dashboard › Geral" quando
 * houver sub-nivel). Sem prefixo "Cropware Farm".
 *
 * Dois modos:
 * - default (standalone): barra branca propria com border-b, container
 *   max-w-1600 (uso antigo, fora do shell de sidebar).
 * - embedded: so o conteudo inline (sem barra/borda/container), pra viver
 *   dentro da topbar do shell de sidebar. O wrapper externo controla layout.
 *
 * Estilo do texto: 14px weight 300. Segmentos anteriores + separadores em
 * slate-400; ULTIMO segmento (pagina atual) em slate-600 weight 400.
 */
interface PageBreadcrumbProps {
  segments: string[];
  embedded?: boolean;
}

export function PageBreadcrumb({ segments, embedded = false }: PageBreadcrumbProps) {
  if (segments.length === 0) return null;
  const inner = (
    <div
      className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap"
      style={{ fontSize: "14px", fontWeight: 300, letterSpacing: "0.2px" }}
    >
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span
            key={i}
            className="flex items-center gap-1.5 shrink-0 last:shrink last:min-w-0 last:truncate"
          >
            {i > 0 && <span style={{ color: "#a1a1aa" }}>›</span>}
            <span
              className={isLast ? "truncate" : ""}
              style={{
                color: isLast ? "#52525b" : "#a1a1aa",
                fontWeight: isLast ? 400 : 300,
              }}
            >
              {segment}
            </span>
          </span>
        );
      })}
    </div>
  );

  if (embedded) return inner;

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-2">
        {inner}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAtividades, useCadastros } from "../hooks/useCadastros";
import { dentroDaJanela } from "../dominio/custo";
import {
  documentoDoPainel,
  montarPainelDaSafra,
} from "../dominio/painelDaSafra";
import {
  CartoesDoRelatorio,
  SecaoDoRelatorio,
} from "../components/SecaoDoRelatorio";
import { BotoesDoRelatorio } from "../relatorios/BotoesDoRelatorio";
import { nomeDeArquivo } from "../relatorios/exportar";

const hojeIso = () => new Date().toISOString().slice(0, 10);

/**
 * Painel da safra (fase 6) — no lugar do Painel de Plantios do Flag Field:
 * área por cultura e finalidade, produtividade colhida, custo agronômico por
 * tipo e a situação dos plantios. O custo por talhão fica em Custos, sem
 * repetir aqui. Regras em dominio/painelDaSafra.ts.
 */
export default function PainelPage() {
  const c = useCadastros();
  const a = useAtividades();
  const [safraId, setSafraId] = useState("");
  const [farmId, setFarmId] = useState("todas");

  // Começa na safra vigente (ou na mais recente), como em Custos.
  useEffect(() => {
    if (safraId || c.safras.length === 0) return;
    setSafraId(
      c.safras.find((s) => dentroDaJanela(hojeIso(), s))?.id ?? c.safras[0].id,
    );
  }, [c.safras, safraId]);

  const safra = c.safras.find((s) => s.id === safraId) ?? null;
  const fazenda =
    farmId === "todas"
      ? null
      : (c.fazendas.find((f) => f.id === farmId) ?? null);

  const doc = useMemo(() => {
    if (!safra) return null;
    const painel = montarPainelDaSafra({
      safra,
      safras: c.safras,
      plantios: c.plantios,
      talhoes: c.talhoes,
      atividades: a.atividades,
      farmId: fazenda?.id ?? null,
      hoje: hojeIso(),
    });
    return documentoDoPainel(painel, {
      safra: safra.name,
      fazenda: fazenda?.name ?? null,
    });
  }, [safra, fazenda, c.safras, c.plantios, c.talhoes, a.atividades]);

  if (c.carregando || a.carregando) return <LoadingState />;

  return (
    <div className="space-y-4">
      <BarraDeTela
        campos={[
          {
            rotulo: "Safra",
            campo: (
              <SearchableSelect
                options={c.safras.map((s) => ({ value: s.id, label: s.name }))}
                value={safraId}
                onValueChange={(v) => setSafraId(v)}
                placeholder="Escolha a safra"
              />
            ),
          },
          {
            rotulo: "Fazenda",
            ativo: farmId !== "todas",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todas", label: "Todas as fazendas" },
                  ...c.fazendas.map((f) => ({ value: f.id, label: f.name })),
                ]}
                value={farmId}
                onValueChange={(v) => setFarmId(v || "todas")}
              />
            ),
          },
        ]}
        acoes={
          doc && !doc.empty ? (
            <BotoesDoRelatorio
              montar={() => doc}
              nome={nomeDeArquivo("painel", safra?.name, fazenda?.name)}
            />
          ) : undefined
        }
      />

      {!safra ? (
        <EmptyStateCard
          title={c.safras.length ? "Escolha a safra" : "Cadastre uma safra"}
          description="O painel mostra uma safra por vez (Field → Safras)."
        />
      ) : !doc || doc.empty ? (
        <EmptyStateCard
          title="Nenhum plantio nesta safra"
          description="Cadastre os plantios (Field → Plantios) com a safra para ver o painel."
        />
      ) : (
        <>
          <CartoesDoRelatorio meta={doc.meta} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {doc.tables.map((t) => (
              <SecaoDoRelatorio
                key={t.title}
                t={t}
                className={
                  t.title === "Plantios" || t.chart?.tipo === "barras"
                    ? "lg:col-span-2"
                    : undefined
                }
              />
            ))}
          </div>
          <p className="text-sm text-slate-500">
            O custo de cada talhão, com o realizado do financeiro ao lado, está
            em{" "}
            <Link to="/campo/custos" className="underline">
              Custo por Talhão
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ItemsCount } from "@/components/ui/ItemsCount";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCadastros } from "../hooks/useCadastros";
import { usePermissoesDoCampo } from "../hooks/usePermissoesDoCampo";
import { CartaoDeCadastro, GradeDeCartoes } from "../components/Cadastro";
import { BotaoNovo, BuscaDaLista } from "../components/BuscaDaLista";
import { FormularioDeProduto } from "../components/FormularioDeProduto";
import { normalizarNome } from "../utils/nomes";
import { CATEGORIAS_DE_PRODUTO, TIPOS_DE_CICLO } from "../dominio/catalogo";
import type { Produto } from "../types";

/**
 * Catálogo de insumos — sementes, defensivos, fertilizantes... Sem preço
 * (decisão de 16/11/2026): o custo é digitado em R$/ha na atividade. Serve para
 * a atividade escolher o produto pelo nome em vez de digitar de novo.
 */
export default function CatalogoPage() {
  const c = useCadastros();
  const { podeCriar, podeMexer } = usePermissoesDoCampo();
  const [busca, setBusca] = useState("");
  const [fCat, setFCat] = useState("todas");
  const [aberto, setAberto] = useState<"novo" | Produto | null>(null);
  const [leitura, setLeitura] = useState(false);
  const [excluindo, setExcluindo] = useState<Produto | null>(null);
  const [apagando, setApagando] = useState(false);

  const lista = useMemo(() => {
    const alvo = normalizarNome(busca);
    return c.produtos.filter(
      (p) =>
        (fCat === "todas" || p.category === fCat) &&
        (!alvo ||
          normalizarNome(p.name).includes(alvo) ||
          normalizarNome(p.active_ingredient ?? "").includes(alvo) ||
          normalizarNome(p.manufacturer ?? "").includes(alvo)),
    );
  }, [c.produtos, busca, fCat]);

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    const res = await c.excluirProduto(excluindo.id);
    setApagando(false);
    if (res.ok) {
      toast.success("Produto excluído");
      setExcluindo(null);
      setAberto(null);
    } else toast.error(res.erro);
  }

  if (aberto) {
    const produto = aberto === "novo" ? null : aberto;
    return (
      <FormularioDeProduto
        key={produto?.id ?? "novo"}
        produto={produto}
        produtos={c.produtos}
        somenteLeitura={leitura}
        aoEditar={
          produto && podeMexer(produto) ? () => setLeitura(false) : undefined
        }
        salvar={c.salvarProduto}
        aoVoltar={() => setAberto(null)}
        aoSalvo={() => setAberto(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <BarraDeTela
        buscaAtiva={Boolean(busca)}
        busca={
          <BuscaDaLista
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar por nome, ingrediente ou fabricante..."
          />
        }
        campos={[
          {
            rotulo: "Categoria",
            ativo: fCat !== "todas",
            campo: (
              <SearchableSelect
                options={[
                  { value: "todas", label: "Todas as categorias" },
                  ...Object.entries(CATEGORIAS_DE_PRODUTO).map(([v, r]) => ({
                    value: v,
                    label: r,
                  })),
                ]}
                value={fCat}
                onValueChange={(v) => setFCat(v || "todas")}
              />
            ),
          },
        ]}
        acaoPrincipal={
          podeCriar ? (
            <BotaoNovo
              rotulo="Novo Produto"
              onClick={() => {
                setAberto("novo");
                setLeitura(false);
              }}
            />
          ) : undefined
        }
      />

      {c.carregando ? (
        <LoadingState />
      ) : c.produtos.length === 0 ? (
        <EmptyStateCard
          title="Catálogo vazio"
          description="Cadastre os insumos que você usa para escolhê-los nas atividades sem digitar de novo."
        />
      ) : (
        <>
          <ItemsCount
            count={lista.length}
            totalCount={c.produtos.length}
            itemLabel="produto"
            itemLabelPlural="produtos"
            showClearFilters={Boolean(busca) || fCat !== "todas"}
            onClearFilters={() => {
              setBusca("");
              setFCat("todas");
            }}
          />
          <GradeDeCartoes>
            {lista.map((p) => {
              const mexe = podeMexer(p);
              return (
                <CartaoDeCadastro
                  key={p.id}
                  titulo={p.name}
                  linhas={[
                    [CATEGORIAS_DE_PRODUTO[p.category], p.manufacturer]
                      .filter(Boolean)
                      .join(" · "),
                    p.category === "sementes"
                      ? [
                          p.crop,
                          p.maturation_group != null
                            ? `GM ${p.maturation_group}`
                            : null,
                          p.cycle_type ? TIPOS_DE_CICLO[p.cycle_type] : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : p.active_ingredient,
                  ]}
                  aoAbrir={() => {
                    setAberto(p);
                    setLeitura(true);
                  }}
                  aoEditar={
                    mexe
                      ? () => {
                          setAberto(p);
                          setLeitura(false);
                        }
                      : undefined
                  }
                  aoExcluir={mexe ? () => setExcluindo(p) : undefined}
                />
              );
            })}
          </GradeDeCartoes>
        </>
      )}

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Excluir Produto"
        itemName={excluindo ? `"${excluindo.name}"` : undefined}
        loading={apagando}
      />
    </div>
  );
}

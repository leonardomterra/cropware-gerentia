import { useState } from "react";
import { toast } from "sonner";
import Plus from "~icons/ph/plus";
import Pencil from "~icons/ph/pencil-simple";
import Trash from "~icons/ph/trash";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import { Campo } from "../Cadastro";
import { FormularioDeProduto } from "../FormularioDeProduto";
import { SubPagina } from "./SubPagina";
import {
  CATEGORIAS_POR_TIPO,
  UNIDADES_DE_DOSE_DE_ENSAIO,
} from "../../dominio/ensaios";
import { CATEGORIAS_DE_PRODUTO } from "../../dominio/catalogo";
import { lerNumero, normalizarNome, numeroParaCampo } from "../../utils/nomes";
import type { Resultado } from "../../hooks/useCadastros";
import type {
  AvaliacaoDoEnsaio,
  ColheitaDoEnsaioRow,
  Ensaio,
  Produto,
  ProdutoInput,
  ProdutoNoEnsaio,
} from "../../types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Produtos comparados no ensaio — principal (o que se quer mostrar) ×
 * concorrente. Vêm do catálogo, filtrado pelo tipo do ensaio (sementes: só da
 * mesma cultura). O custo R$/ha daqui é o que o ROI usa.
 */
export function AbaProdutos({
  ensaio,
  produtos,
  avaliacoes,
  colheitas,
  catalogo,
  somenteLeitura,
  salvar,
  excluir,
  salvarNoCatalogo,
}: {
  ensaio: Ensaio;
  produtos: ProdutoNoEnsaio[];
  avaliacoes: AvaliacaoDoEnsaio[];
  colheitas: ColheitaDoEnsaioRow[];
  catalogo: Produto[];
  somenteLeitura: boolean;
  salvar: (d: Record<string, unknown>, id?: string) => Promise<Resultado>;
  excluir: (id: string) => Promise<Resultado>;
  salvarNoCatalogo: (d: ProdutoInput) => Promise<Resultado>;
}) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<ProdutoNoEnsaio | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [excluindo, setExcluindo] = useState<ProdutoNoEnsaio | null>(null);
  const [apagando, setApagando] = useState(false);
  const sementes = ensaio.trial_type === "sementes";

  const categorias = CATEGORIAS_POR_TIPO[ensaio.trial_type];
  const jaNoEnsaio = new Set(
    produtos.map((p) => p.catalog_product_id).filter(Boolean),
  );
  const alvo = normalizarNome(busca);
  const disponiveis = catalogo
    .filter((p) => !categorias || categorias.includes(p.category))
    .filter((p) => !jaNoEnsaio.has(p.id))
    // Semente de outra cultura não serve para este ensaio.
    .filter(
      (p) => p.category !== "sementes" || !p.crop || p.crop === ensaio.crop,
    )
    .filter(
      (p) =>
        !alvo ||
        normalizarNome(
          `${p.name} ${p.manufacturer ?? ""} ${p.genetics ?? ""}`,
        ).includes(alvo),
    )
    .slice(0, 12);

  async function adicionar(p: Produto, role: "principal" | "concorrente") {
    const res = await salvar({
      trial_id: ensaio.id,
      catalog_product_id: p.id,
      name: p.name,
      manufacturer: p.manufacturer,
      role,
    });
    if (res.ok) toast.success(`${p.name} adicionado como ${role}`);
    else toast.error(res.erro);
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    const res = await excluir(excluindo.id);
    setApagando(false);
    if (res.ok) {
      toast.success("Produto removido do ensaio");
      setExcluindo(null);
    } else toast.error(res.erro);
  }

  if (cadastrando) {
    return (
      <FormularioDeProduto
        produto={null}
        produtos={catalogo}
        nomeInicial={busca}
        categoriaInicial={categorias?.[0] ?? "outros"}
        salvar={(d) => salvarNoCatalogo(d)}
        aoVoltar={() => setCadastrando(false)}
        aoSalvo={() => setCadastrando(false)}
      />
    );
  }

  if (editando) {
    return (
      <EdicaoDoProduto
        p={editando}
        sementes={sementes}
        somenteLeitura={somenteLeitura}
        aoVoltar={() => setEditando(null)}
        salvar={async (d) => {
          const res = await salvar(d, editando.id);
          if (res.ok) {
            toast.success("Produto atualizado");
            setEditando(null);
          } else toast.error(res.erro);
        }}
      />
    );
  }

  const coluna = (role: "principal" | "concorrente") => {
    const lista = produtos.filter((p) => p.role === role);
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-500">
          {role === "principal" ? "Principais" : "Concorrentes"} ·{" "}
          {lista.length}
        </h3>
        {lista.length === 0 && (
          <p className="text-sm text-slate-400 rounded-lg border border-dashed border-slate-200 p-4 text-center">
            Nenhum ainda
          </p>
        )}
        {lista.map((p) => {
          const falta = sementes ? p.population == null : p.dose_value == null;
          return (
            <div
              key={p.id}
              className="rounded-lg border border-slate-200 bg-white p-3 space-y-1"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {p.name}
                  </p>
                  {p.manufacturer && (
                    <p className="text-xs text-slate-500">{p.manufacturer}</p>
                  )}
                </div>
                {!somenteLeitura && (
                  <>
                    <ActionIconButton
                      icon={Pencil}
                      label="Editar"
                      onClick={() => setEditando(p)}
                    />
                    <ActionIconButton
                      icon={Trash}
                      label="Remover"
                      tone="danger"
                      onClick={() => setExcluindo(p)}
                    />
                  </>
                )}
              </div>
              <p className="text-sm text-slate-600">
                {sementes
                  ? p.population != null
                    ? `${p.population.toLocaleString("pt-BR")} sementes/ha`
                    : null
                  : p.dose_value != null
                    ? `${numeroParaCampo(p.dose_value)} ${p.dose_unit ?? ""}`
                    : null}
                {p.cost_ha != null ? ` · ${brl(p.cost_ha)}/ha` : ""}
              </p>
              {falta && (
                <span className="inline-block text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                  Preencher {sementes ? "população" : "dose"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!somenteLeitura && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no catálogo (nome, fabricante, genética)..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCadastrando(true)}
            >
              <Plus className="size-4 mr-1.5" />
              Cadastrar no catálogo
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            {categorias
              ? `Mostrando: ${categorias.map((c) => CATEGORIAS_DE_PRODUTO[c]).join(", ")}`
              : "Mostrando todas as categorias"}
          </p>
          <ul className="divide-y divide-slate-100">
            {disponiveis.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 min-w-0 truncate text-sm text-slate-700">
                  {p.name}
                  {p.manufacturer && (
                    <span className="text-slate-400"> · {p.manufacturer}</span>
                  )}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void adicionar(p, "principal")}
                >
                  + Principal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void adicionar(p, "concorrente")}
                >
                  + Concorrente
                </Button>
              </li>
            ))}
            {disponiveis.length === 0 && (
              <li className="text-sm text-slate-400 py-2">
                Nada no catálogo com essa busca. Cadastre o produto para usá-lo
                aqui.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {coluna("principal")}
        {coluna("concorrente")}
      </div>

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Remover produto do ensaio"
        itemName={excluindo ? `"${excluindo.name}"` : undefined}
        loading={apagando}
        cascadeItems={
          excluindo
            ? [
                {
                  label: "Avaliações",
                  count: avaliacoes.filter((a) => a.product_id === excluindo.id)
                    .length,
                },
                {
                  label: "Colheita",
                  count: colheitas.filter((c) => c.product_id === excluindo.id)
                    .length,
                },
              ]
            : undefined
        }
      />
    </div>
  );
}

function EdicaoDoProduto({
  p,
  sementes,
  somenteLeitura,
  aoVoltar,
  salvar,
}: {
  p: ProdutoNoEnsaio;
  sementes: boolean;
  somenteLeitura: boolean;
  aoVoltar: () => void;
  salvar: (d: Record<string, unknown>) => Promise<void>;
}) {
  const [f, setF] = useState({
    role: p.role,
    dose: numeroParaCampo(p.dose_value),
    unidade: p.dose_unit ?? "L/ha",
    populacao: numeroParaCampo(p.population),
    custo: numeroParaCampo(p.cost_ha),
    notes: p.notes ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  return (
    <SubPagina
      titulo={p.name}
      formId="form-produto-ensaio"
      salvando={salvando}
      aoVoltar={aoVoltar}
      somenteLeitura={somenteLeitura}
    >
      <form
        id="form-produto-ensaio"
        onSubmit={async (e) => {
          e.preventDefault();
          setSalvando(true);
          await salvar({
            role: f.role,
            dose_value: sementes ? null : lerNumero(f.dose),
            dose_unit: sementes ? null : f.unidade,
            population: sementes ? lerNumero(f.populacao) : null,
            cost_ha: lerNumero(f.custo),
            notes: f.notes.trim() || null,
          });
          setSalvando(false);
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <Campo rotulo="Papel no ensaio">
          <Select
            value={f.role}
            onValueChange={(v) =>
              setF((s) => ({ ...s, role: v as typeof f.role }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="principal">Principal</SelectItem>
              <SelectItem value="concorrente">Concorrente</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        {sementes ? (
          <Campo rotulo="População (sementes/ha)">
            <Input
              inputMode="decimal"
              value={f.populacao}
              onChange={(e) =>
                setF((s) => ({ ...s, populacao: e.target.value }))
              }
            />
          </Campo>
        ) : (
          <Campo rotulo="Dose">
            <div className="flex gap-1">
              <Input
                inputMode="decimal"
                value={f.dose}
                onChange={(e) => setF((s) => ({ ...s, dose: e.target.value }))}
              />
              <Select
                value={f.unidade}
                onValueChange={(v) => setF((s) => ({ ...s, unidade: v }))}
              >
                <SelectTrigger className="w-28 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_DE_DOSE_DE_ENSAIO.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Campo>
        )}
        <Campo rotulo="Custo (R$/ha)" ajuda="Usado no ROI do ensaio.">
          <Input
            inputMode="decimal"
            value={f.custo}
            onChange={(e) => setF((s) => ({ ...s, custo: e.target.value }))}
            placeholder="0,00"
          />
        </Campo>
        <Campo rotulo="Observações" className={cn("sm:col-span-2")}>
          <Textarea
            rows={3}
            value={f.notes}
            onChange={(e) => setF((s) => ({ ...s, notes: e.target.value }))}
          />
        </Campo>
      </form>
    </SubPagina>
  );
}

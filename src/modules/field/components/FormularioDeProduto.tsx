import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import { Campo } from "./Cadastro";
import { acharRepetido, lerNumero, numeroParaCampo } from "../utils/nomes";
import {
  CATEGORIAS_DE_PRODUTO,
  TIPOS_DE_CICLO,
  type CategoriaDeProduto,
  type TipoDeCiclo,
} from "../dominio/catalogo";
import { CULTURAS } from "../dominio/plantios";
import type { Produto, ProdutoInput } from "../types";
import type { Resultado } from "../hooks/useCadastros";

/**
 * Formulário de produto do catálogo. Componente à parte porque abre de dois
 * lugares: a tela do Catálogo e, como sub-página, a atividade ("cadastrar no
 * catálogo" sem perder o que já foi digitado nela).
 */
export function FormularioDeProduto({
  produto,
  produtos,
  somenteLeitura,
  aoEditar,
  nomeInicial = "",
  categoriaInicial = "defensivos",
  salvar,
  aoVoltar,
  aoSalvo,
}: {
  produto: Produto | null;
  produtos: Produto[];
  somenteLeitura?: boolean;
  aoEditar?: () => void;
  nomeInicial?: string;
  categoriaInicial?: CategoriaDeProduto;
  salvar: (d: ProdutoInput, id?: string) => Promise<Resultado>;
  aoVoltar: () => void;
  aoSalvo: (id: string, nome: string) => void;
}) {
  const [f, setF] = useState({
    name: produto?.name ?? nomeInicial,
    category: (produto?.category ?? categoriaInicial) as CategoriaDeProduto,
    manufacturer: produto?.manufacturer ?? "",
    supplier: produto?.supplier ?? "",
    active_ingredient: produto?.active_ingredient ?? "",
    crop: produto?.crop ?? "",
    genetics: produto?.genetics ?? "",
    maturation_group: numeroParaCampo(produto?.maturation_group),
    cycle_days: produto?.cycle_days != null ? String(produto.cycle_days) : "",
    cycle_type: (produto?.cycle_type ?? "") as TipoDeCiclo | "",
    notes: produto?.notes ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const repetido = acharRepetido(produtos, f.name, produto?.id);
  const semente = f.category === "sementes";
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  async function enviar() {
    if (!f.name.trim() || repetido) return;
    setSalvando(true);
    const t = (v: string) => v.trim() || null;
    const res = await salvar(
      {
        name: f.name.trim(),
        category: f.category,
        manufacturer: t(f.manufacturer),
        supplier: t(f.supplier),
        active_ingredient: semente ? null : t(f.active_ingredient),
        crop: semente ? t(f.crop) : null,
        genetics: semente ? t(f.genetics) : null,
        maturation_group: semente ? lerNumero(f.maturation_group) : null,
        cycle_days: semente && f.cycle_days ? Number(f.cycle_days) : null,
        cycle_type: semente && f.cycle_type ? f.cycle_type : null,
        notes: t(f.notes),
      },
      produto?.id,
    );
    setSalvando(false);
    if (res.ok) {
      toast.success(produto ? "Produto atualizado" : "Produto cadastrado");
      aoSalvo(res.id, f.name.trim());
    } else toast.error(res.erro);
  }

  return (
    <PaginaDeFormulario
      formId="form-produto"
      rotuloSalvar={produto ? "Salvar" : "Cadastrar Produto"}
      descricao={produto ? produto.name : "Novo produto do catálogo"}
      somenteLeitura={somenteLeitura}
      aoEditar={aoEditar}
      aoVoltar={aoVoltar}
      salvando={salvando}
    >
      <form
        id="form-produto"
        onSubmit={(e) => {
          e.preventDefault();
          // A sub-página vive DENTRO do formulário da atividade em alguns
          // fluxos: sem isto o submit subiria para ele.
          e.stopPropagation();
          void enviar();
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <Campo
          rotulo="Nome"
          htmlFor="pr-nome"
          obrigatorio
          erro={repetido ? "Já existe um produto com esse nome." : null}
        >
          <Input
            id="pr-nome"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={120}
            required
          />
        </Campo>
        <Campo rotulo="Categoria" obrigatorio>
          <Select
            value={f.category}
            onValueChange={(v) => set("category", v as CategoriaDeProduto)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORIAS_DE_PRODUTO).map(([v, r]) => (
                <SelectItem key={v} value={v}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo rotulo="Fabricante" htmlFor="pr-fab">
          <Input
            id="pr-fab"
            value={f.manufacturer}
            onChange={(e) => set("manufacturer", e.target.value)}
          />
        </Campo>
        <Campo
          rotulo={semente ? "Fornecedor" : "Distribuidor"}
          htmlFor="pr-forn"
        >
          <Input
            id="pr-forn"
            value={f.supplier}
            onChange={(e) => set("supplier", e.target.value)}
          />
        </Campo>
        {semente ? (
          <>
            <Campo rotulo="Cultura">
              <Select value={f.crop} onValueChange={(v) => set("crop", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Cultura" />
                </SelectTrigger>
                <SelectContent>
                  {CULTURAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Genética" htmlFor="pr-gen">
              <Input
                id="pr-gen"
                value={f.genetics}
                onChange={(e) => set("genetics", e.target.value)}
              />
            </Campo>
            <Campo rotulo="Grupo de maturação" htmlFor="pr-gm">
              <Input
                id="pr-gm"
                inputMode="decimal"
                value={f.maturation_group}
                onChange={(e) => set("maturation_group", e.target.value)}
                placeholder="6,4"
              />
            </Campo>
            <Campo rotulo="Ciclo (dias)" htmlFor="pr-ciclo">
              <Input
                id="pr-ciclo"
                inputMode="numeric"
                value={f.cycle_days}
                onChange={(e) =>
                  set("cycle_days", e.target.value.replace(/\D/g, ""))
                }
              />
            </Campo>
            <Campo rotulo="Tipo de ciclo">
              <Select
                value={f.cycle_type}
                onValueChange={(v) => set("cycle_type", v as TipoDeCiclo)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de ciclo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_DE_CICLO).map(([v, r]) => (
                    <SelectItem key={v} value={v}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </>
        ) : (
          <Campo
            rotulo="Ingrediente ativo / composição"
            htmlFor="pr-ia"
            className="sm:col-span-2"
          >
            <Input
              id="pr-ia"
              value={f.active_ingredient}
              onChange={(e) => set("active_ingredient", e.target.value)}
            />
          </Campo>
        )}
        <Campo rotulo="Observações" htmlFor="pr-obs" className="sm:col-span-2">
          <Textarea
            id="pr-obs"
            rows={3}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Campo>
      </form>
    </PaginaDeFormulario>
  );
}

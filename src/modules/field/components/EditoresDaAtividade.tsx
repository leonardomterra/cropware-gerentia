import Plus from "~icons/ph/plus";
import Trash from "~icons/ph/trash";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIAS_DE_OBSERVACAO,
  SEVERIDADES,
  TIPOS_DE_PRODUTO_APLICADO,
  UNIDADES_DE_DOSE,
  type ObservacaoDaAtividade,
} from "../dominio/atividades";
import { lerNumero } from "../utils/nomes";
import { linhaVazia, type LinhaDeProduto } from "./linhasDeProduto";
import type { Produto } from "../types";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Produtos da atividade (aplicação, adubação) — portado do
 * ActivityProductsEditor do Flag Field. O nome vem do catálogo (sugestão
 * enquanto digita) ou é livre; o custo é digitado em R$/ha por produto, porque
 * o catálogo não tem preço (decisão de 16/11/2026).
 */
export function EditorDeProdutos({
  linhas,
  aoMudar,
  catalogo,
  comTipo,
  area,
  aoCadastrarNoCatalogo,
}: {
  linhas: LinhaDeProduto[];
  aoMudar: (l: LinhaDeProduto[]) => void;
  catalogo: Produto[];
  /** Coluna "Tipo" (herbicida, fungicida...) — só na aplicação. */
  comTipo?: boolean;
  /** Área da atividade, para o total em R$. */
  area: number;
  /** Abre o cadastro no catálogo com o nome digitado na linha. */
  aoCadastrarNoCatalogo?: (chave: string, nome: string) => void;
}) {
  const porNome = new Map(catalogo.map((p) => [p.name.toLowerCase(), p.id]));
  const set = (chave: string, k: keyof LinhaDeProduto, v: string) =>
    aoMudar(
      linhas.map((l) => {
        if (l.chave !== chave) return l;
        const nova = { ...l, [k]: v };
        if (k === "nome")
          nova.produto_id = porNome.get(v.trim().toLowerCase()) ?? null;
        return nova;
      }),
    );
  const totalHa = linhas.reduce((s, l) => s + (lerNumero(l.custo_ha) ?? 0), 0);

  return (
    <div className="space-y-2">
      <datalist id="catalogo-de-produtos">
        {catalogo.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      {linhas.map((l, i) => (
        <div
          key={l.chave}
          className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end rounded-lg border border-slate-200 p-2"
        >
          <div className="col-span-2 sm:col-span-4">
            {i === 0 && <span className="text-xs text-slate-500">Produto</span>}
            <Input
              list="catalogo-de-produtos"
              value={l.nome}
              onChange={(e) => set(l.chave, "nome", e.target.value)}
              placeholder="Nome do produto"
            />
            {l.nome.trim() && !l.produto_id && aoCadastrarNoCatalogo && (
              <button
                type="button"
                onClick={() => aoCadastrarNoCatalogo(l.chave, l.nome.trim())}
                className="text-xs text-slate-500 underline-offset-2 hover:underline mt-1"
              >
                Cadastrar no catálogo
              </button>
            )}
          </div>
          {comTipo && (
            <div className="col-span-2 sm:col-span-2">
              {i === 0 && <span className="text-xs text-slate-500">Tipo</span>}
              <Select
                value={l.tipo}
                onValueChange={(v) => set(l.chave, "tipo", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DE_PRODUTO_APLICADO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={comTipo ? "sm:col-span-2" : "sm:col-span-3"}>
            {i === 0 && <span className="text-xs text-slate-500">Dose</span>}
            <div className="flex gap-1">
              <Input
                inputMode="decimal"
                value={l.dose}
                onChange={(e) => set(l.chave, "dose", e.target.value)}
                className="min-w-0"
              />
              <Select
                value={l.unidade}
                onValueChange={(v) => set(l.chave, "unidade", v)}
              >
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_DE_DOSE.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className={comTipo ? "sm:col-span-3" : "sm:col-span-4"}>
            {i === 0 && (
              <span className="text-xs text-slate-500">Custo (R$/ha)</span>
            )}
            <Input
              inputMode="decimal"
              value={l.custo_ha}
              onChange={(e) => set(l.chave, "custo_ha", e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="sm:col-span-1 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover produto"
              onClick={() => aoMudar(linhas.filter((x) => x.chave !== l.chave))}
            >
              <Trash className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => aoMudar([...linhas, linhaVazia()])}
        >
          <Plus className="size-4 mr-1.5" />
          Adicionar produto
        </Button>
        <span className="text-sm text-slate-600 tabular-nums">
          {brl(totalHa)}/ha · {brl(totalHa * area)} em{" "}
          {area.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha
        </span>
      </div>
    </div>
  );
}

/** Alvos observados (pragas, doenças...) com severidade. */
export function EditorDeObservacoes({
  itens,
  aoMudar,
}: {
  itens: ObservacaoDaAtividade[];
  aoMudar: (o: ObservacaoDaAtividade[]) => void;
}) {
  const set = (i: number, k: keyof ObservacaoDaAtividade, v: string) =>
    aoMudar(itens.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  return (
    <div className="space-y-2">
      {itens.map((o, i) => (
        <div
          key={i}
          className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 p-2"
        >
          <div className="col-span-2 sm:col-span-4">
            <Select
              value={o.categoria}
              onValueChange={(v) => set(i, "categoria", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_DE_OBSERVACAO.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <Input
              value={o.alvo}
              onChange={(e) => set(i, "alvo", e.target.value)}
              placeholder="Alvo (ex.: percevejo-marrom)"
            />
          </div>
          <div className="sm:col-span-3">
            <Select
              value={o.severidade}
              onValueChange={(v) => set(i, "severidade", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                {SEVERIDADES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-1 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover observação"
              onClick={() => aoMudar(itens.filter((_, j) => j !== i))}
            >
              <Trash className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          aoMudar([...itens, { categoria: "", alvo: "", severidade: "" }])
        }
      >
        <Plus className="size-4 mr-1.5" />
        Adicionar observação
      </Button>
    </div>
  );
}

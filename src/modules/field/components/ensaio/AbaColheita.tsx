import { useState } from "react";
import { toast } from "sonner";
import Plus from "~icons/ph/plus";
import Pencil from "~icons/ph/pencil-simple";
import Trash from "~icons/ph/trash";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Campo } from "../Cadastro";
import { SubPagina } from "./SubPagina";
import {
  corrigirUmidade,
  produtividadeCalculada,
  produtividadeDe,
} from "../../dominio/ensaios";
import { lerNumero, numeroParaCampo } from "../../utils/nomes";
import type { Resultado } from "../../hooks/useCadastros";
import type { ColheitaDoEnsaioRow, Ensaio, ProdutoNoEnsaio } from "../../types";

const sc = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} sc/ha`;
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const ALVOS = [
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
];

/**
 * Colheita — uma por produto. Produtividade digitada (sc/ha) ou calculada do
 * peso e da área; correção de umidade pela MESMA função na prévia e no salvar
 * (no Flag Field a prévia não corrigia acima do alvo e o banco corrigia).
 */
export function AbaColheita({
  ensaio,
  produtos,
  colheitas,
  somenteLeitura,
  salvar,
  excluir,
}: {
  ensaio: Ensaio;
  produtos: ProdutoNoEnsaio[];
  colheitas: ColheitaDoEnsaioRow[];
  somenteLeitura: boolean;
  salvar: (d: Record<string, unknown>, id?: string) => Promise<Resultado>;
  excluir: (id: string) => Promise<Resultado>;
}) {
  const [aberta, setAberta] = useState<ColheitaDoEnsaioRow | "nova" | null>(
    null,
  );
  const colheitaDe = (pid: string) =>
    colheitas.find((c) => c.product_id === pid) ?? null;
  const semColheita = produtos.filter((p) => !colheitaDe(p.id));

  if (aberta) {
    const atual = aberta === "nova" ? null : aberta;
    return (
      <FormularioDeColheita
        atual={atual}
        produtos={
          atual
            ? produtos.filter((p) => p.id === atual.product_id)
            : semColheita
        }
        somenteLeitura={somenteLeitura}
        aoVoltar={() => setAberta(null)}
        salvar={async (d) => {
          const res = await salvar({ trial_id: ensaio.id, ...d }, atual?.id);
          if (res.ok) {
            toast.success("Colheita registrada");
            setAberta(null);
          } else toast.error(res.erro);
        }}
      />
    );
  }

  const coluna = (role: "principal" | "concorrente") => (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-500">
        {role === "principal" ? "Principais" : "Concorrentes"}
      </h3>
      {produtos
        .filter((p) => p.role === role)
        .map((p) => {
          const c = colheitaDe(p.id);
          return (
            <div
              key={p.id}
              className="rounded-lg border border-slate-200 bg-white p-3 space-y-1"
            >
              <div className="flex items-start gap-2">
                <p className="flex-1 min-w-0 font-medium text-slate-900 truncate">
                  {p.name}
                </p>
                {c && !somenteLeitura && (
                  <>
                    <ActionIconButton
                      icon={Pencil}
                      label="Editar"
                      onClick={() => setAberta(c)}
                    />
                    <ActionIconButton
                      icon={Trash}
                      label="Excluir"
                      tone="danger"
                      onClick={async () => {
                        const res = await excluir(c.id);
                        if (!res.ok) toast.error(res.erro);
                      }}
                    />
                  </>
                )}
              </div>
              {c ? (
                <>
                  <p className="text-lg font-medium text-slate-900 tabular-nums">
                    {sc(produtividadeDe(c))}
                    {c.target_moisture != null && (
                      <span className="text-xs font-normal text-slate-500">
                        {" "}
                        a {c.target_moisture}%
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Bruta {sc(c.productivity)} · umidade {c.moisture}%
                    {c.impurity != null ? ` · impureza ${c.impurity}%` : ""}
                    {c.pmg != null ? ` · PMG ${c.pmg} g` : ""}
                    {c.harvest_date ? ` · ${dataBr(c.harvest_date)}` : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Ainda não colhido</p>
              )}
            </div>
          );
        })}
    </div>
  );

  return (
    <div className="space-y-4">
      {!somenteLeitura && (
        <Button
          type="button"
          variant="secondary"
          disabled={semColheita.length === 0}
          onClick={() => setAberta("nova")}
        >
          <Plus className="size-4 mr-1.5" />
          Registrar colheita
        </Button>
      )}
      {produtos.length === 0 ? (
        <p className="text-sm text-slate-500">
          Adicione os produtos do ensaio antes.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coluna("principal")}
          {coluna("concorrente")}
        </div>
      )}
    </div>
  );
}

function FormularioDeColheita({
  atual,
  produtos,
  somenteLeitura,
  aoVoltar,
  salvar,
}: {
  atual: ColheitaDoEnsaioRow | null;
  produtos: ProdutoNoEnsaio[];
  somenteLeitura: boolean;
  aoVoltar: () => void;
  salvar: (d: Record<string, unknown>) => Promise<void>;
}) {
  const [f, setF] = useState({
    product_id: atual?.product_id ?? produtos[0]?.id ?? "",
    harvest_date: atual?.harvest_date ?? new Date().toISOString().slice(0, 10),
    modo: atual?.input_mode ?? ("manual" as "manual" | "calculada"),
    produtividade: numeroParaCampo(atual?.productivity),
    peso: numeroParaCampo(atual?.net_weight_kg),
    area: numeroParaCampo(atual?.harvested_area_ha),
    umidade: numeroParaCampo(atual?.moisture),
    alvo: atual
      ? atual.target_moisture != null
        ? String(atual.target_moisture)
        : "sem"
      : "13",
    impureza: numeroParaCampo(atual?.impurity),
    pmg: numeroParaCampo(atual?.pmg),
  });
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const bruta =
    f.modo === "manual"
      ? (lerNumero(f.produtividade) ?? 0)
      : produtividadeCalculada(lerNumero(f.peso) ?? 0, lerNumero(f.area) ?? 0);
  const umidade = lerNumero(f.umidade);
  const alvo = f.alvo === "sem" ? null : Number(f.alvo);
  const corrigida =
    umidade != null && bruta > 0 ? corrigirUmidade(bruta, umidade, alvo) : null;

  return (
    <SubPagina
      titulo={atual ? "Editar colheita" : "Registrar colheita"}
      formId="form-colheita"
      salvando={salvando}
      aoVoltar={aoVoltar}
      somenteLeitura={somenteLeitura}
    >
      <form
        id="form-colheita"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.product_id || !(bruta > 0) || umidade == null) {
            toast.error("Informe o produto, a produtividade e a umidade.");
            return;
          }
          setSalvando(true);
          await salvar({
            product_id: f.product_id,
            harvest_date: f.harvest_date || null,
            input_mode: f.modo,
            productivity: bruta,
            net_weight_kg: f.modo === "calculada" ? lerNumero(f.peso) : null,
            harvested_area_ha:
              f.modo === "calculada" ? lerNumero(f.area) : null,
            moisture: umidade,
            target_moisture: alvo,
            corrected_productivity: corrigida,
            impurity: lerNumero(f.impureza),
            pmg: lerNumero(f.pmg),
          });
          setSalvando(false);
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <Campo rotulo="Produto" obrigatorio>
          <Select
            value={f.product_id}
            onValueChange={(v) => set("product_id", v)}
            disabled={!!atual}
          >
            <SelectTrigger>
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo rotulo="Data da colheita">
          <Input
            type="date"
            value={f.harvest_date}
            onChange={(e) => set("harvest_date", e.target.value)}
          />
        </Campo>
        <Campo rotulo="Como informar">
          <Select
            value={f.modo}
            onValueChange={(v) => set("modo", v as typeof f.modo)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Produtividade (sc/ha)</SelectItem>
              <SelectItem value="calculada">Peso e área colhida</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        {f.modo === "manual" ? (
          <Campo rotulo="Produtividade bruta (sc/ha)" obrigatorio>
            <Input
              inputMode="decimal"
              value={f.produtividade}
              onChange={(e) => set("produtividade", e.target.value)}
            />
          </Campo>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Campo rotulo="Peso líquido (kg)" obrigatorio>
              <Input
                inputMode="decimal"
                value={f.peso}
                onChange={(e) => set("peso", e.target.value)}
              />
            </Campo>
            <Campo rotulo="Área colhida (ha)" obrigatorio>
              <Input
                inputMode="decimal"
                value={f.area}
                onChange={(e) => set("area", e.target.value)}
              />
            </Campo>
          </div>
        )}
        <Campo rotulo="Umidade (%)" obrigatorio>
          <Input
            inputMode="decimal"
            value={f.umidade}
            onChange={(e) => set("umidade", e.target.value)}
          />
        </Campo>
        <Campo
          rotulo="Corrigir umidade para"
          ajuda="A produtividade é ajustada para a umidade padrão de comercialização (normalmente 13%)."
        >
          <Select value={f.alvo} onValueChange={(v) => set("alvo", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sem">Não corrigir</SelectItem>
              {ALVOS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo rotulo="Impureza (%)">
          <Input
            inputMode="decimal"
            value={f.impureza}
            onChange={(e) => set("impureza", e.target.value)}
          />
        </Campo>
        <Campo rotulo="PMG (g)">
          <Input
            inputMode="decimal"
            value={f.pmg}
            onChange={(e) => set("pmg", e.target.value)}
          />
        </Campo>
        <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700 tabular-nums">
          {bruta > 0 ? (
            <>
              Bruta <strong className="font-medium">{sc(bruta)}</strong>
              {corrigida != null && alvo != null && (
                <>
                  {" "}
                  → corrigida a {alvo}%:{" "}
                  <strong className="font-medium">{sc(corrigida)}</strong>
                </>
              )}
            </>
          ) : (
            "Informe a produtividade (ou peso e área) para ver o resultado."
          )}
        </div>
      </form>
    </SubPagina>
  );
}

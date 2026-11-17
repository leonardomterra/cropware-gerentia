import { useState } from "react";
import { toast } from "sonner";
import Plus from "~icons/ph/plus";
import Pencil from "~icons/ph/pencil-simple";
import Trash from "~icons/ph/trash";
import CheckCircle from "~icons/ph/check-circle-fill";
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
import { SubPagina } from "./SubPagina";
import {
  ESCALAS,
  ESTADIOS_DE_ENSAIO,
  REFERENCIAS,
  SUGESTOES_DE_CARACTERISTICA,
  TIPOS_DE_AVALIACAO,
  UNIDADES_QUANTITATIVAS,
  type Caracteristica,
} from "../../dominio/ensaios";
import type { Resultado } from "../../hooks/useCadastros";
import type {
  AvaliacaoDoEnsaio,
  Ensaio,
  EtapaDoEnsaio,
  ProdutoNoEnsaio,
} from "../../types";

const hojeIso = () => new Date().toISOString().slice(0, 10);
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const rotuloDaCaracteristica = (c: Caracteristica) =>
  c.tipo === "quantitativa"
    ? `${c.nome}${c.unidade ? ` (${c.unidade}${c.referencia ?? ""})` : ""}`
    : c.nome;

/**
 * Avaliações — a "Avaliação Livre" do Flag Field: uma ETAPA (tipo + estádio +
 * características) vale para todos os produtos, e cada produto recebe os
 * valores dela. Avaliação sem etapa (o bot do WhatsApp grava assim) aparece em
 * "Avaliações avulsas" — no Flag Field ela sumia da tela.
 */
export function AbaAvaliacoes({
  ensaio,
  produtos,
  etapas,
  avaliacoes,
  somenteLeitura,
  salvarEtapa,
  excluirEtapa,
  salvarAvaliacao,
  excluirAvaliacao,
}: {
  ensaio: Ensaio;
  produtos: ProdutoNoEnsaio[];
  etapas: EtapaDoEnsaio[];
  avaliacoes: AvaliacaoDoEnsaio[];
  somenteLeitura: boolean;
  salvarEtapa: (d: Record<string, unknown>, id?: string) => Promise<Resultado>;
  excluirEtapa: (id: string) => Promise<Resultado>;
  salvarAvaliacao: (
    d: Record<string, unknown>,
    id?: string,
  ) => Promise<Resultado>;
  excluirAvaliacao: (id: string) => Promise<Resultado>;
}) {
  const [etapaAberta, setEtapaAberta] = useState<EtapaDoEnsaio | "nova" | null>(
    null,
  );
  const [preenchendo, setPreenchendo] = useState<{
    etapa: EtapaDoEnsaio;
    produto: ProdutoNoEnsaio;
  } | null>(null);
  const [excluindoEtapa, setExcluindoEtapa] = useState<EtapaDoEnsaio | null>(
    null,
  );

  const avaliacaoDe = (stepId: string, productId: string) =>
    avaliacoes.find(
      (a) => a.step_id === stepId && a.product_id === productId,
    ) ?? null;
  const avulsas = avaliacoes.filter((a) => !a.step_id);
  const total = etapas.length * produtos.length;
  const preenchidas = etapas.reduce(
    (s, e) =>
      s +
      produtos.filter((p) => {
        const a = avaliacaoDe(e.id, p.id);
        return (
          a && e.characteristics.every((c) => (a.values[c.id] ?? "") !== "")
        );
      }).length,
    0,
  );

  if (etapaAberta) {
    return (
      <FormularioDeEtapa
        etapa={etapaAberta === "nova" ? null : etapaAberta}
        somenteLeitura={somenteLeitura}
        aoVoltar={() => setEtapaAberta(null)}
        salvar={async (d) => {
          const res = await salvarEtapa(
            { trial_id: ensaio.id, ...d },
            etapaAberta === "nova" ? undefined : etapaAberta.id,
          );
          if (res.ok) {
            toast.success("Etapa salva");
            setEtapaAberta(null);
          } else toast.error(res.erro);
        }}
      />
    );
  }

  if (preenchendo) {
    const atual = avaliacaoDe(preenchendo.etapa.id, preenchendo.produto.id);
    return (
      <PreenchimentoDaAvaliacao
        etapa={preenchendo.etapa}
        produto={preenchendo.produto}
        atual={atual}
        somenteLeitura={somenteLeitura}
        aoVoltar={() => setPreenchendo(null)}
        salvar={async (d) => {
          const res = await salvarAvaliacao(
            {
              trial_id: ensaio.id,
              step_id: preenchendo.etapa.id,
              product_id: preenchendo.produto.id,
              ...d,
            },
            atual?.id,
          );
          if (res.ok) {
            toast.success("Avaliação registrada");
            setPreenchendo(null);
          } else toast.error(res.erro);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!somenteLeitura && (
          <Button
            type="button"
            variant="secondary"
            disabled={produtos.length === 0}
            title={
              produtos.length === 0 ? "Adicione os produtos antes" : undefined
            }
            onClick={() => setEtapaAberta("nova")}
          >
            <Plus className="size-4 mr-1.5" />
            Nova etapa de avaliação
          </Button>
        )}
        {total > 0 && (
          <span className="text-sm text-slate-500">
            {preenchidas} de {total} preenchidas
          </span>
        )}
      </div>

      {etapas.length === 0 && (
        <p className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-6 text-center">
          {produtos.length
            ? "Crie uma etapa (ex.: Fitossanidade em R3) com as características a medir; depois preencha produto a produto."
            : "Adicione os produtos do ensaio antes de avaliar."}
        </p>
      )}

      {etapas.map((e) => (
        <div
          key={e.id}
          className="rounded-lg border border-slate-200 bg-white p-3 space-y-2"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900">
                {e.evaluation_type}
                {e.stage ? ` · ${e.stage}` : ""}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {e.characteristics.map(rotuloDaCaracteristica).join(" · ")}
              </p>
            </div>
            {!somenteLeitura && (
              <>
                <ActionIconButton
                  icon={Pencil}
                  label="Editar etapa"
                  onClick={() => setEtapaAberta(e)}
                />
                <ActionIconButton
                  icon={Trash}
                  label="Excluir etapa"
                  tone="danger"
                  onClick={() => setExcluindoEtapa(e)}
                />
              </>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {produtos.map((p) => {
              const a = avaliacaoDe(e.id, p.id);
              const completa =
                !!a &&
                e.characteristics.every((c) => (a.values[c.id] ?? "") !== "");
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreenchendo({ etapa: e, produto: p })}
                  className={cn(
                    "text-left rounded-md border p-2 space-y-0.5 transition-colors",
                    completa
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    {completa && (
                      <CheckCircle className="size-4 text-emerald-600" />
                    )}
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-[11px] text-slate-400">
                      {p.role === "principal" ? "Principal" : "Concorrente"}
                    </span>
                  </p>
                  {a ? (
                    <>
                      <p className="text-xs text-slate-500">{dataBr(a.date)}</p>
                      {e.characteristics.map((c) => (
                        <p
                          key={c.id}
                          className="text-xs text-slate-600 truncate"
                        >
                          {c.nome}:{" "}
                          <span className="text-slate-900">
                            {a.values[c.id] || "—"}
                          </span>
                        </p>
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {somenteLeitura ? "Sem avaliação" : "Preencher"}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {avulsas.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <h3 className="text-sm font-medium text-slate-500">
            Avaliações avulsas · {avulsas.length}
          </h3>
          <p className="text-xs text-slate-400">
            Registradas sem etapa (por exemplo, pelo WhatsApp).
          </p>
          {avulsas.map((a) => {
            const p = produtos.find((x) => x.id === a.product_id);
            const defs = a.characteristics ?? [];
            return (
              <div
                key={a.id}
                className="flex items-start gap-2 border-t border-slate-100 pt-2"
              >
                <div className="flex-1 min-w-0 text-sm">
                  <p className="text-slate-800">
                    {p?.name ?? "Produto removido"} · {dataBr(a.date)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {defs.length
                      ? defs
                          .map((c) => `${c.nome}: ${a.values[c.id] ?? "—"}`)
                          .join(" · ")
                      : Object.entries(a.values)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ") || a.notes}
                  </p>
                </div>
                {!somenteLeitura && (
                  <ActionIconButton
                    icon={Trash}
                    label="Excluir"
                    tone="danger"
                    onClick={async () => {
                      const res = await excluirAvaliacao(a.id);
                      if (!res.ok) toast.error(res.erro);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <DeleteConfirmationDialog
        open={excluindoEtapa !== null}
        onOpenChange={(o) => !o && setExcluindoEtapa(null)}
        onConfirm={async () => {
          if (!excluindoEtapa) return;
          const res = await excluirEtapa(excluindoEtapa.id);
          if (res.ok) setExcluindoEtapa(null);
          else toast.error(res.erro);
        }}
        title="Excluir etapa de avaliação"
        itemName={
          excluindoEtapa ? `"${excluindoEtapa.evaluation_type}"` : undefined
        }
        cascadeItems={
          excluindoEtapa
            ? [
                {
                  label: "Avaliações preenchidas",
                  count: avaliacoes.filter(
                    (a) => a.step_id === excluindoEtapa.id,
                  ).length,
                },
              ]
            : undefined
        }
      />
    </div>
  );
}

// ---- Etapa: tipo, estádio e características -----------------------------------
function FormularioDeEtapa({
  etapa,
  somenteLeitura,
  aoVoltar,
  salvar,
}: {
  etapa: EtapaDoEnsaio | null;
  somenteLeitura: boolean;
  aoVoltar: () => void;
  salvar: (d: Record<string, unknown>) => Promise<void>;
}) {
  const [tipo, setTipo] = useState(
    etapa?.evaluation_type ?? TIPOS_DE_AVALIACAO[0],
  );
  const [estadio, setEstadio] = useState(etapa?.stage ?? "");
  const [cars, setCars] = useState<Caracteristica[]>(
    etapa?.characteristics?.length
      ? etapa.characteristics
      : [
          {
            id: crypto.randomUUID(),
            nome: "",
            tipo: "quantitativa",
            unidade: "nº",
            referencia: "",
          },
        ],
  );
  const [salvando, setSalvando] = useState(false);
  const sugestaoPorNome = new Map(
    SUGESTOES_DE_CARACTERISTICA.map((s) => [s.nome.toLowerCase(), s]),
  );
  const setCar = (id: string, patch: Partial<Caracteristica>) =>
    setCars((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <SubPagina
      titulo={etapa ? "Editar etapa" : "Nova etapa de avaliação"}
      formId="form-etapa"
      salvando={salvando}
      aoVoltar={aoVoltar}
      somenteLeitura={somenteLeitura}
    >
      <form
        id="form-etapa"
        onSubmit={async (e) => {
          e.preventDefault();
          const validas = cars.filter((c) => c.nome.trim());
          if (validas.length === 0) {
            toast.error("Inclua pelo menos uma característica.");
            return;
          }
          setSalvando(true);
          await salvar({
            evaluation_type: tipo,
            stage: estadio || null,
            characteristics: validas.map((c) => ({
              ...c,
              nome: c.nome.trim(),
            })),
          });
          setSalvando(false);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo rotulo="Tipo de avaliação" obrigatorio>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DE_AVALIACAO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Estádio">
            <Input
              list="estadios-de-ensaio"
              value={estadio}
              onChange={(e) => setEstadio(e.target.value)}
              placeholder="R3, V4..."
            />
            <datalist id="estadios-de-ensaio">
              {ESTADIOS_DE_ENSAIO.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Campo>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-700">Características</p>
          <datalist id="sugestoes-de-caracteristica">
            {SUGESTOES_DE_CARACTERISTICA.map((s) => (
              <option key={s.nome} value={s.nome} />
            ))}
          </datalist>
          {cars.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end rounded-lg border border-slate-200 p-2"
            >
              <div className="col-span-2 sm:col-span-4">
                <Input
                  list="sugestoes-de-caracteristica"
                  value={c.nome}
                  placeholder="Ex.: Sanidade foliar"
                  onChange={(e) => {
                    const nome = e.target.value;
                    const sug = sugestaoPorNome.get(nome.toLowerCase());
                    // Escolheu uma sugestão: já traz tipo, unidade e escala.
                    setCar(c.id, sug ? { ...sug, nome } : { nome });
                  }}
                />
              </div>
              <div className="sm:col-span-3">
                <Select
                  value={c.tipo}
                  onValueChange={(v) =>
                    setCar(
                      c.id,
                      v === "quantitativa"
                        ? {
                            tipo: "quantitativa",
                            unidade: c.unidade ?? "nº",
                            escala: undefined,
                          }
                        : {
                            tipo: "qualitativa",
                            escala: c.escala ?? "nota-1-9",
                            unidade: undefined,
                          },
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantitativa">Quantitativa</SelectItem>
                    <SelectItem value="qualitativa">Qualitativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {c.tipo === "quantitativa" ? (
                <div className="sm:col-span-4 flex gap-1">
                  <Select
                    value={c.unidade ?? "nº"}
                    onValueChange={(v) => setCar(c.id, { unidade: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_QUANTITATIVAS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={c.referencia || "nenhuma"}
                    onValueChange={(v) =>
                      setCar(c.id, { referencia: v === "nenhuma" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERENCIAS.map((r) => (
                        <SelectItem key={r || "nenhuma"} value={r || "nenhuma"}>
                          {r || "sem referência"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="sm:col-span-4">
                  <Select
                    value={c.escala ?? "nota-1-9"}
                    onValueChange={(v) => setCar(c.id, { escala: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ESCALAS).map(([v, x]) => (
                        <SelectItem key={v} value={v}>
                          {x.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="sm:col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover característica"
                  onClick={() =>
                    setCars((cs) => cs.filter((x) => x.id !== c.id))
                  }
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
              setCars((cs) => [
                ...cs,
                {
                  id: crypto.randomUUID(),
                  nome: "",
                  tipo: "quantitativa",
                  unidade: "nº",
                  referencia: "",
                },
              ])
            }
          >
            <Plus className="size-4 mr-1.5" />
            Adicionar característica
          </Button>
        </div>
      </form>
    </SubPagina>
  );
}

// ---- Preencher a avaliação de um produto numa etapa -------------------------------
function PreenchimentoDaAvaliacao({
  etapa,
  produto,
  atual,
  somenteLeitura,
  aoVoltar,
  salvar,
}: {
  etapa: EtapaDoEnsaio;
  produto: ProdutoNoEnsaio;
  atual: AvaliacaoDoEnsaio | null;
  somenteLeitura: boolean;
  aoVoltar: () => void;
  salvar: (d: Record<string, unknown>) => Promise<void>;
}) {
  const [data, setData] = useState(atual?.date ?? hojeIso());
  const [valores, setValores] = useState<Record<string, string>>(
    atual?.values ?? {},
  );
  const [notes, setNotes] = useState(atual?.notes ?? "");
  const [salvando, setSalvando] = useState(false);

  return (
    <SubPagina
      titulo={`${produto.name} · ${etapa.evaluation_type}${etapa.stage ? ` ${etapa.stage}` : ""}`}
      formId="form-avaliacao"
      rotuloSalvar="Registrar avaliação"
      salvando={salvando}
      aoVoltar={aoVoltar}
      somenteLeitura={somenteLeitura}
    >
      <form
        id="form-avaliacao"
        onSubmit={async (e) => {
          e.preventDefault();
          setSalvando(true);
          await salvar({
            date: data,
            values: valores,
            notes: notes.trim() || null,
          });
          setSalvando(false);
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <Campo rotulo="Data" obrigatorio>
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />
        </Campo>
        <div className="hidden sm:block" />
        {etapa.characteristics.map((c) => {
          const v = valores[c.id] ?? "";
          const set = (x: string) => setValores((s) => ({ ...s, [c.id]: x }));
          const opcoes =
            c.tipo === "qualitativa" ? ESCALAS[c.escala ?? ""]?.opcoes : null;
          return (
            <Campo key={c.id} rotulo={rotuloDaCaracteristica(c)}>
              {opcoes ? (
                <Select value={v} onValueChange={set}>
                  <SelectTrigger>
                    <SelectValue placeholder={ESCALAS[c.escala!].rotulo} />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoes.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : c.tipo === "quantitativa" || c.escala === "percentual" ? (
                <Input
                  inputMode="decimal"
                  value={v}
                  onChange={(e) => set(e.target.value)}
                  placeholder={
                    c.escala === "percentual" ? "0 a 100" : undefined
                  }
                />
              ) : (
                <Input value={v} onChange={(e) => set(e.target.value)} />
              )}
            </Campo>
          );
        })}
        <Campo rotulo="Observações" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Campo>
      </form>
    </SubPagina>
  );
}

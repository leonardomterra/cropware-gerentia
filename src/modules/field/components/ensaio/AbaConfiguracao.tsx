import { useState } from "react";
import { toast } from "sonner";
import Save from "~icons/ph/floppy-disk";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Campo } from "../Cadastro";
import { CULTURAS, identidadeDoPlantio } from "../../dominio/plantios";
import { TIPOS_DE_ENSAIO, type TipoDeEnsaio } from "../../dominio/ensaios";
import type { Resultado } from "../../hooks/useCadastros";
import type { Ensaio, Fazenda, Plantio, Safra, Talhao } from "../../types";

/**
 * Configuração do ensaio — onde fica e o que é. Fazenda obrigatória; talhão,
 * plantio e safra opcionais (decisão de 16/11/2026: o DM conduz campo em área
 * de cliente sem desenhar o talhão). O banco deduz talhão e fazenda do plantio.
 */
export function AbaConfiguracao({
  ensaio,
  fazendas,
  talhoes,
  plantios,
  safras,
  plantioInicial,
  somenteLeitura,
  salvar,
  aoCriado,
}: {
  ensaio: Ensaio | null;
  fazendas: Fazenda[];
  talhoes: Talhao[];
  plantios: Plantio[];
  safras: Safra[];
  /** "Criar ensaio neste plantio" — já vem preenchido. */
  plantioInicial?: Plantio | null;
  somenteLeitura: boolean;
  salvar: (d: Record<string, unknown>, id?: string) => Promise<Resultado>;
  aoCriado: (id: string) => void;
}) {
  const talhaoDoPlantio = plantioInicial
    ? talhoes.find((t) => t.id === plantioInicial.plot_id)
    : null;
  const [f, setF] = useState({
    farm_id:
      ensaio?.farm_id ??
      talhaoDoPlantio?.farm_id ??
      (fazendas.length === 1 ? fazendas[0].id : ""),
    plot_id: ensaio?.plot_id ?? plantioInicial?.plot_id ?? "",
    planting_id: ensaio?.planting_id ?? plantioInicial?.id ?? "",
    season_id: ensaio?.season_id ?? plantioInicial?.season_id ?? "",
    crop: ensaio?.crop ?? plantioInicial?.crop ?? "",
    trial_type: (ensaio?.trial_type ?? "sementes") as TipoDeEnsaio,
    name: ensaio?.name ?? "",
    standard_variety: ensaio?.standard_variety ?? "",
    implantation_date:
      ensaio?.implantation_date ?? plantioInicial?.planting_date ?? "",
    notes: ensaio?.notes ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  async function enviar() {
    if (!f.farm_id || !f.crop || !f.name.trim()) {
      toast.error("Preencha fazenda, cultura e nome do ensaio.");
      return;
    }
    setSalvando(true);
    const res = await salvar(
      {
        farm_id: f.farm_id,
        plot_id: f.plot_id || null,
        planting_id: f.planting_id || null,
        season_id: f.season_id || null,
        crop: f.crop,
        trial_type: f.trial_type,
        name: f.name.trim(),
        standard_variety: f.standard_variety.trim() || null,
        implantation_date: f.implantation_date || null,
        notes: f.notes.trim() || null,
      },
      ensaio?.id,
    );
    setSalvando(false);
    if (res.ok) {
      toast.success(
        ensaio ? "Ensaio atualizado" : "Ensaio criado — agora os produtos",
      );
      if (!ensaio) aoCriado(res.id);
    } else toast.error(res.erro);
  }

  const talhoesDaFazenda = talhoes.filter((t) => t.farm_id === f.farm_id);
  const plantiosDoTalhao = plantios.filter((p) => p.plot_id === f.plot_id);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
      className="space-y-4"
    >
      <fieldset
        disabled={somenteLeitura}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <Campo rotulo="Fazenda" obrigatorio>
          <SearchableSelect
            options={fazendas.map((x) => ({ value: x.id, label: x.name }))}
            value={f.farm_id}
            onValueChange={(v) =>
              setF((s) => ({ ...s, farm_id: v, plot_id: "", planting_id: "" }))
            }
            placeholder="Escolha a fazenda"
            searchPlaceholder="Buscar fazenda..."
            disabled={somenteLeitura}
          />
        </Campo>
        <Campo
          rotulo="Talhão"
          ajuda="Opcional. Sem talhão, o ensaio fica só na fazenda."
        >
          <SearchableSelect
            options={[
              { value: "", label: "Sem talhão" },
              ...talhoesDaFazenda.map((t) => ({ value: t.id, label: t.name })),
            ]}
            value={f.plot_id}
            onValueChange={(v) =>
              setF((s) => ({ ...s, plot_id: v, planting_id: "" }))
            }
            disabled={somenteLeitura || !f.farm_id}
          />
        </Campo>
        <Campo
          rotulo="Plantio"
          ajuda="Ligar ao plantio põe as atividades dele (aplicações etc.) junto do ensaio."
        >
          <SearchableSelect
            options={[
              { value: "", label: "Sem plantio" },
              ...plantiosDoTalhao.map((p) => ({
                value: p.id,
                label: identidadeDoPlantio(p),
              })),
            ]}
            value={f.planting_id}
            onValueChange={(v) => {
              const p = plantios.find((x) => x.id === v);
              setF((s) => ({
                ...s,
                planting_id: v,
                crop: s.crop || p?.crop || "",
                season_id: s.season_id || p?.season_id || "",
              }));
            }}
            disabled={somenteLeitura || !f.plot_id}
          />
        </Campo>
        <Campo rotulo="Safra">
          <SearchableSelect
            options={[
              { value: "", label: "Sem safra" },
              ...safras.map((s) => ({ value: s.id, label: s.name })),
            ]}
            value={f.season_id}
            onValueChange={(v) => set("season_id", v)}
            disabled={somenteLeitura}
          />
        </Campo>
        <Campo rotulo="Cultura" obrigatorio>
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
        <Campo
          rotulo="Tipo de ensaio"
          obrigatorio
          ajuda="Define que categorias do catálogo aparecem ao escolher os produtos."
        >
          <Select
            value={f.trial_type}
            onValueChange={(v) => set("trial_type", v as TipoDeEnsaio)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS_DE_ENSAIO).map(([v, x]) => (
                <SelectItem key={v} value={v}>
                  {x.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo rotulo="Nome do ensaio" htmlFor="en-nome" obrigatorio>
          <Input
            id="en-nome"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={40}
            placeholder="Ex.: Fungicida safra 25/26"
            required
          />
        </Campo>
        <Campo
          rotulo="Variedade padrão da fazenda"
          htmlFor="en-padrao"
          ajuda="A testemunha: a variedade (ou o manejo) que a fazenda usa normalmente."
        >
          <Input
            id="en-padrao"
            value={f.standard_variety}
            onChange={(e) => set("standard_variety", e.target.value)}
          />
        </Campo>
        <Campo rotulo="Data de implantação" htmlFor="en-data">
          <Input
            id="en-data"
            type="date"
            value={f.implantation_date}
            onChange={(e) => set("implantation_date", e.target.value)}
          />
        </Campo>
        <Campo rotulo="Descrição" htmlFor="en-desc" className="sm:col-span-2">
          <Textarea
            id="en-desc"
            rows={3}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Campo>
      </fieldset>
      {!somenteLeitura && (
        <Button
          type="submit"
          disabled={salvando}
          className="h-9 px-5 font-normal shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="size-4 mr-2" />
          {salvando ? "Salvando..." : ensaio ? "Salvar" : "Criar ensaio"}
        </Button>
      )}
    </form>
  );
}

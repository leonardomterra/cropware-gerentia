import { useMemo, useState } from "react";
import { toast } from "sonner";
import CalendarIcon from "~icons/ph/calendar-duotone";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { useCadastros } from "../hooks/useCadastros";
import { usePermissoesDoCampo } from "../hooks/usePermissoesDoCampo";
import {
  CartaoDeCadastro,
  Campo,
  GradeDeCartoes,
} from "../components/Cadastro";
import { BotaoNovo } from "../components/BuscaDaLista";
import { acharRepetido } from "../utils/nomes";
import type { Safra } from "../types";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Sugestão para a próxima safra: o ano agrícola que começa em julho
 * ("2025/26": 01/07/2025 a 30/06/2026). É só o ponto de partida — a pessoa
 * ajusta para a safrinha, o inverno ou o calendário dela.
 */
function sugestao(): { name: string; starts_on: string; ends_on: string } {
  const hoje = new Date();
  const ano =
    hoje.getMonth() >= 6 ? hoje.getFullYear() : hoje.getFullYear() - 1;
  return {
    name: `Safra ${ano}/${String(ano + 1).slice(2)}`,
    starts_on: `${ano}-07-01`,
    ends_on: `${ano + 1}-06-30`,
  };
}

/**
 * Safras — cadastradas pela organização (decisão de 16/11/2026). O plantio
 * escolhe a safra; a atividade sem plantio cai na safra pela data. É a régua
 * do relatório de custo por talhão.
 */
export default function SafrasPage() {
  const c = useCadastros();
  const { podeCriar, podeMexer } = usePermissoesDoCampo();
  const [aberto, setAberto] = useState<"novo" | Safra | null>(null);
  const [leitura, setLeitura] = useState(false);
  const [form, setForm] = useState({
    name: "",
    starts_on: "",
    ends_on: "",
    notes: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Safra | null>(null);
  const [apagando, setApagando] = useState(false);

  const plantiosPorSafra = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of c.plantios)
      if (p.season_id) m.set(p.season_id, (m.get(p.season_id) ?? 0) + 1);
    return m;
  }, [c.plantios]);

  const editando = aberto !== null && aberto !== "novo" ? aberto : null;
  const repetido = acharRepetido(c.safras, form.name, editando?.id);
  const datasInvalidas =
    !!form.starts_on && !!form.ends_on && form.ends_on < form.starts_on;

  function abrir(s: Safra | "novo", somenteLer: boolean) {
    setAberto(s);
    setLeitura(somenteLer);
    setForm(
      s === "novo"
        ? { ...sugestao(), notes: "" }
        : {
            name: s.name,
            starts_on: s.starts_on,
            ends_on: s.ends_on,
            notes: s.notes ?? "",
          },
    );
  }

  async function salvar() {
    if (
      !form.name.trim() ||
      !form.starts_on ||
      !form.ends_on ||
      repetido ||
      datasInvalidas
    )
      return;
    setSalvando(true);
    const res = await c.salvarSafra(
      {
        name: form.name.trim(),
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        notes: form.notes.trim() || null,
      },
      editando?.id,
    );
    setSalvando(false);
    if (res.ok) {
      toast.success(editando ? "Safra atualizada" : "Safra cadastrada");
      setAberto(null);
    } else toast.error(res.erro);
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    const res = await c.excluirSafra(excluindo.id);
    setApagando(false);
    if (res.ok) {
      toast.success("Safra excluída");
      setExcluindo(null);
      setAberto(null);
    } else toast.error(res.erro);
  }

  if (aberto) {
    return (
      <PaginaDeFormulario
        formId="form-safra"
        rotuloSalvar={editando ? "Salvar" : "Cadastrar Safra"}
        descricao={editando ? editando.name : "Nova safra"}
        somenteLeitura={leitura}
        aoEditar={
          editando && podeMexer(editando) ? () => setLeitura(false) : undefined
        }
        aoVoltar={() => setAberto(null)}
        salvando={salvando}
      >
        <form
          id="form-safra"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Campo
            rotulo="Nome"
            htmlFor="s-nome"
            obrigatorio
            erro={repetido ? "Já existe uma safra com esse nome." : null}
            className="sm:col-span-2"
          >
            <Input
              id="s-nome"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Safra 2025/26, Safrinha 2026..."
              maxLength={60}
              required
            />
          </Campo>
          <Campo rotulo="Início" htmlFor="s-ini" obrigatorio>
            <Input
              id="s-ini"
              type="date"
              value={form.starts_on}
              onChange={(e) =>
                setForm((s) => ({ ...s, starts_on: e.target.value }))
              }
              required
            />
          </Campo>
          <Campo
            rotulo="Fim"
            htmlFor="s-fim"
            obrigatorio
            erro={datasInvalidas ? "O fim vem antes do início." : null}
            ajuda="Lançamentos e atividades sem plantio entram na safra pela data, dentro deste período."
          >
            <Input
              id="s-fim"
              type="date"
              value={form.ends_on}
              onChange={(e) =>
                setForm((s) => ({ ...s, ends_on: e.target.value }))
              }
              required
            />
          </Campo>
          <Campo rotulo="Observações" htmlFor="s-obs" className="sm:col-span-2">
            <Textarea
              id="s-obs"
              rows={3}
              value={form.notes}
              onChange={(e) =>
                setForm((s) => ({ ...s, notes: e.target.value }))
              }
            />
          </Campo>
        </form>
      </PaginaDeFormulario>
    );
  }

  return (
    <div className="space-y-3">
      <BarraDeTela
        acaoPrincipal={
          podeCriar ? (
            <BotaoNovo
              rotulo="Nova Safra"
              onClick={() => abrir("novo", false)}
            />
          ) : undefined
        }
      />
      {c.carregando ? (
        <LoadingState />
      ) : c.safras.length === 0 ? (
        <EmptyStateCard
          icon={CalendarIcon}
          title="Nenhuma safra cadastrada"
          description="Cadastre a safra (ex.: 2025/26) para organizar plantios e ver o custo de cada talhão nela."
        />
      ) : (
        <GradeDeCartoes>
          {c.safras.map((s) => {
            const n = plantiosPorSafra.get(s.id) ?? 0;
            const mexe = podeMexer(s);
            return (
              <CartaoDeCadastro
                key={s.id}
                titulo={s.name}
                linhas={[
                  `${dataBr(s.starts_on)} a ${dataBr(s.ends_on)}`,
                  `${n} ${n === 1 ? "plantio" : "plantios"}`,
                ]}
                aoAbrir={() => abrir(s, true)}
                aoEditar={mexe ? () => abrir(s, false) : undefined}
                aoExcluir={mexe ? () => setExcluindo(s) : undefined}
              />
            );
          })}
        </GradeDeCartoes>
      )}

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Excluir Safra"
        itemName={excluindo ? `"${excluindo.name}"` : undefined}
        loading={apagando}
        cascadeItems={
          excluindo
            ? [
                {
                  label: "Plantios que ficam sem safra (não são apagados)",
                  count: plantiosPorSafra.get(excluindo.id) ?? 0,
                },
              ]
            : undefined
        }
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Plus from "~icons/ph/plus";
import PencilSimple from "~icons/ph/pencil-simple";
import Trash from "~icons/ph/trash";
import CreditCardDuotone from "~icons/ph/credit-card-duotone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA, BOTAO_BARRA_PRIMARIO } from "@/lib/ui-tokens";
import { api } from "@/utils/api";
import { BANDEIRAS, type Card } from "./types";

interface FormState {
  nome: string;
  bandeira: string;
  emissor: string;
  ultimos_digitos: string;
  dia_fechamento: string;
  dia_vencimento: string;
  ativo: boolean;
}

const VAZIO: FormState = {
  nome: "",
  bandeira: "",
  emissor: "",
  ultimos_digitos: "",
  dia_fechamento: "",
  dia_vencimento: "",
  ativo: true,
};

/** "•••• 4821 · Nubank" — o que identifica o cartão numa lista. */
function subtitulo(c: Card): string {
  const partes: string[] = [];
  if (c.ultimos_digitos) partes.push(`•••• ${c.ultimos_digitos}`);
  if (c.emissor) partes.push(c.emissor);
  if (c.dia_vencimento) partes.push(`vence dia ${c.dia_vencimento}`);
  return partes.join(" - ") || "sem identificação";
}

/**
 * Gerenciador de cartões — Etapa 3 de docs/CARTOES-E-FATURAS.md.
 *
 * O cartão é da PESSOA: cada um opera o seu, e o gestor consulta os de todos.
 * Quem decide isso é a RLS de `farm_cards`; aqui só usamos `meu_user_id`, que a
 * rota devolve, para saber quais linhas mostram os botões de editar e excluir.
 * Reimplementar a regra no front daria duas fontes para divergir.
 */
export function CardsManager() {
  const [cards, setCards] = useState<Card[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Card | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Card | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ cards: Card[]; meu_user_id: string | null }>(
        "/cards",
      );
      setCards(r.cards ?? []);
      setMeuId(r.meu_user_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar cartões");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setForm(VAZIO);
    setAberto(true);
  }

  function abrirEdicao(c: Card) {
    setEditando(c);
    setForm({
      nome: c.nome,
      bandeira: c.bandeira ?? "",
      emissor: c.emissor ?? "",
      ultimos_digitos: c.ultimos_digitos ?? "",
      dia_fechamento: c.dia_fechamento ? String(c.dia_fechamento) : "",
      dia_vencimento: c.dia_vencimento ? String(c.dia_vencimento) : "",
      ativo: c.ativo,
    });
    setAberto(true);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error("Dê um nome ao cartão.");
      return;
    }
    if (form.ultimos_digitos && !/^\d{4}$/.test(form.ultimos_digitos)) {
      toast.error("Os últimos dígitos são exatamente 4 números.");
      return;
    }
    setSalvando(true);
    try {
      const corpo = {
        nome: form.nome.trim(),
        bandeira: form.bandeira || null,
        emissor: form.emissor.trim() || null,
        ultimos_digitos: form.ultimos_digitos || null,
        // Dia em branco = null, não 0: 0 seria um dia válido no banco e daria
        // um vencimento impossível.
        dia_fechamento: form.dia_fechamento
          ? Number(form.dia_fechamento)
          : null,
        dia_vencimento: form.dia_vencimento
          ? Number(form.dia_vencimento)
          : null,
        ativo: form.ativo,
      };
      if (editando) {
        await api(`/cards/${editando.id}`, { method: "PATCH", body: corpo });
        toast.success("Cartão atualizado");
      } else {
        await api("/cards", { method: "POST", body: corpo });
        toast.success("Cartão cadastrado");
      }
      setAberto(false);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!excluindo) return;
    await api(`/cards/${excluindo.id}`, { method: "DELETE" });
    toast.success("Cartão excluído");
    setExcluindo(null);
    await carregar();
  }

  // Criar/editar SUBSTITUI a lista, dentro da aba (docs/PADRAO-DE-PAGINA.md §6).
  if (aberto) {
    return (
      <PaginaDeFormulario
        formId="form-cartao"
        rotuloSalvar={editando ? "Salvar" : "Cadastrar Cartão"}
        descricao={editando ? `Editando ${editando.nome}` : "Novo cartão"}
        aoVoltar={() => setAberto(false)}
        salvando={salvando}
      >
        <form
          id="form-cartao"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 block">
                Nome *
              </label>
              <Input
                value={form.nome}
                onChange={(e) =>
                  setForm((s) => ({ ...s, nome: e.target.value }))
                }
                placeholder="Nubank pessoal, Corporativo Ana..."
                maxLength={60}
              />
              <p className="text-sm text-slate-500">
                Como você chama esse cartão no dia a dia.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 block">
                Banco emissor
              </label>
              <Input
                value={form.emissor}
                onChange={(e) =>
                  setForm((s) => ({ ...s, emissor: e.target.value }))
                }
                placeholder="Nubank, Itaú, Sicredi..."
                maxLength={40}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 block">
                Bandeira
              </label>
              <Select
                value={form.bandeira || "nenhuma"}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, bandeira: v === "nenhuma" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Não informada</SelectItem>
                  {BANDEIRAS.map((b) => (
                    <SelectItem key={b.valor} value={b.valor}>
                      {b.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 block">
                Últimos 4 dígitos
              </label>
              <Input
                value={form.ultimos_digitos}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    ultimos_digitos: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4),
                  }))
                }
                placeholder="4821"
                inputMode="numeric"
              />
              {/* É por eles que a fatura fotografada vai reconhecer o cartão —
                  vale explicar, senão parece campo decorativo. */}
              <p className="text-sm text-slate-500">
                É por eles que o sistema reconhece de qual cartão é uma fatura.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 block">
                Dia do fechamento
              </label>
              <Input
                value={form.dia_fechamento}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    dia_fechamento: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 2),
                  }))
                }
                placeholder="28"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 block">
                Dia do vencimento
              </label>
              <Input
                value={form.dia_vencimento}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    dia_vencimento: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 2),
                  }))
                }
                placeholder="05"
                inputMode="numeric"
              />
              {/* Fechamento e vencimento são coisas diferentes; sem os dois,
                  "a fatura de agosto" fica ambíguo. */}
              <p className="text-sm text-slate-500">
                A compra depois do fechamento cai na fatura seguinte.
              </p>
            </div>
          </div>

          {editando && (
            <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/60 p-3">
              <div className="min-w-0">
                <span className="text-sm text-slate-700">Cartão ativo</span>
                <p className="text-sm text-slate-500 mt-0.5">
                  Desligado, ele some dos seletores mas continua no histórico —
                  as faturas antigas seguem apontando para ele.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm((s) => ({ ...s, ativo: v }))}
                className="mt-0.5 shrink-0"
              />
            </div>
          )}
        </form>
      </PaginaDeFormulario>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button
          variant="default"
          onClick={abrirNovo}
          className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto")}
        >
          <Plus className="size-4 mr-2" />
          Novo Cartão
        </Button>
      </header>

      <div className="flex items-center justify-end px-1 min-h-[28px]">
        <span className="text-sm text-slate-500">
          {cards.length} {cards.length === 1 ? "cartão" : "cartões"}
        </span>
      </div>

      {loading && cards.length === 0 ? (
        <LoadingState />
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-700">Nenhum cartão cadastrado.</p>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre os cartões para o sistema saber de qual deles é cada
            fatura.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((c) => {
            // Só o dono opera. A RLS já recusaria, mas mostrar botão que dá 404
            // é pior do que não mostrar.
            const meu = c.user_id === meuId;
            return (
              <div
                key={c.id}
                className={cn(
                  "bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3",
                  !c.ativo && "opacity-60",
                )}
              >
                <CreditCardDuotone
                  className={cn(
                    "size-7 shrink-0",
                    c.ativo ? "text-violet-500" : "text-slate-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">
                    {c.nome}
                    {!c.ativo && (
                      <span className="ml-2 font-normal text-slate-500">
                        inativo
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    {subtitulo(c)}
                  </div>
                </div>

                {meu ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => abrirEdicao(c)}
                      className={cn(BOTAO_BARRA, "rounded-md")}
                    >
                      <PencilSimple className="size-3.5 mr-2 shrink-0" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setExcluindo(c)}
                      className="h-9 px-4 font-normal rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:text-red-800"
                    >
                      <Trash className="size-3.5 mr-2 shrink-0" />
                      Excluir
                    </Button>
                  </div>
                ) : (
                  // Cartão de outra pessoa: o gestor vê, não mexe.
                  <span className="text-sm text-slate-400">
                    de outra pessoa
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmActionDialog
        open={excluindo !== null}
        onOpenChange={(o) => {
          if (!o) setExcluindo(null);
        }}
        title="Excluir este cartão?"
        description={
          excluindo
            ? `${excluindo.nome} sai do cadastro. Se ele já tiver lançamentos, a exclusão é recusada — nesse caso desative, para o histórico não perder o vínculo.`
            : ""
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loadingLabel="Excluindo..."
        onConfirm={excluir}
      />
    </div>
  );
}

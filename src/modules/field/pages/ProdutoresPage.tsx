import { useMemo, useState } from "react";
import { toast } from "sonner";
import UserIcon from "~icons/ph/user-duotone";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BarraDeTela } from "@/components/ui/BarraDeTela";
import { PaginaDeFormulario } from "@/components/ui/PaginaDeFormulario";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { ItemsCount } from "@/components/ui/ItemsCount";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { useCadastros, contarLancamentosLigados } from "../hooks/useCadastros";
import { usePermissoesDoCampo } from "../hooks/usePermissoesDoCampo";
import {
  CartaoDeCadastro,
  Campo,
  GradeDeCartoes,
} from "../components/Cadastro";
import { BotaoNovo, BuscaDaLista } from "../components/BuscaDaLista";
import { acharRepetido, normalizarNome } from "../utils/nomes";
import {
  documentoValido,
  mascaraDocumento,
  soDigitos,
} from "../utils/documento";
import type { Produtor } from "../types";

const VAZIO = {
  name: "",
  document: "",
  email: "",
  phone: "",
  partner: "",
  notes: "",
};
type Form = typeof VAZIO;

/**
 * Produtores — o nível acima das fazendas, para quem atende vários produtores
 * (modo "consultor"; ver utils/modoDeUso.ts). Portado do Flag Field
 * (FarmManagement, aba Produtores), sem a importação CSV e sem ações em lote,
 * que ficaram para depois.
 */
export default function ProdutoresPage() {
  const c = useCadastros();
  const { podeCriar, podeMexer } = usePermissoesDoCampo();
  const [busca, setBusca] = useState("");
  // null = lista; "novo" = criando; Produtor = vendo/editando esse.
  const [aberto, setAberto] = useState<"novo" | Produtor | null>(null);
  const [leitura, setLeitura] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<{
    p: Produtor;
    lancamentos: number;
  } | null>(null);
  const [apagando, setApagando] = useState(false);

  const fazendasPorProdutor = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of c.fazendas)
      if (f.producer_id) m.set(f.producer_id, (m.get(f.producer_id) ?? 0) + 1);
    return m;
  }, [c.fazendas]);

  const lista = useMemo(() => {
    const alvo = normalizarNome(busca);
    return c.produtores.filter(
      (p) =>
        !alvo ||
        normalizarNome(p.name).includes(alvo) ||
        soDigitos(p.document ?? "").includes(soDigitos(busca) || "§"),
    );
  }, [c.produtores, busca]);

  const editando = aberto !== null && aberto !== "novo" ? aberto : null;
  const repetido = acharRepetido(c.produtores, form.name, editando?.id);
  const docInvalido = !documentoValido(form.document);

  function abrir(p: Produtor | "novo", somenteLer: boolean) {
    setAberto(p);
    setLeitura(somenteLer);
    setForm(
      p === "novo"
        ? VAZIO
        : {
            name: p.name,
            document: p.document ? mascaraDocumento(p.document) : "",
            email: p.email ?? "",
            phone: p.phone ?? "",
            partner: p.partner ?? "",
            notes: p.notes ?? "",
          },
    );
  }

  async function salvar() {
    if (!form.name.trim() || repetido || docInvalido) return;
    setSalvando(true);
    const t = (v: string) => v.trim() || null;
    const res = await c.salvarProdutor(
      {
        name: form.name.trim(),
        document: soDigitos(form.document) || null,
        email: t(form.email),
        phone: t(form.phone),
        partner: t(form.partner),
        notes: t(form.notes),
      },
      editando?.id,
    );
    setSalvando(false);
    if (res.ok) {
      toast.success(editando ? "Produtor atualizado" : "Produtor cadastrado");
      setAberto(null);
    } else {
      toast.error(res.erro);
    }
  }

  async function pedirExclusao(p: Produtor) {
    const farmIds = c.fazendas
      .filter((f) => f.producer_id === p.id)
      .map((f) => f.id);
    setExcluindo({
      p,
      lancamentos: await contarLancamentosLigados({ farmIds }),
    });
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    const res = await c.excluirProdutor(excluindo.p.id);
    setApagando(false);
    if (res.ok) {
      toast.success("Produtor excluído");
      setExcluindo(null);
      setAberto(null);
    } else toast.error(res.erro);
  }

  if (aberto) {
    return (
      <PaginaDeFormulario
        formId="form-produtor"
        rotuloSalvar={editando ? "Salvar" : "Cadastrar Produtor"}
        descricao={editando ? editando.name : "Novo produtor"}
        somenteLeitura={leitura}
        aoEditar={
          editando && podeMexer(editando) ? () => setLeitura(false) : undefined
        }
        aoVoltar={() => setAberto(null)}
        salvando={salvando}
      >
        <form
          id="form-produtor"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Campo
            rotulo="Nome"
            htmlFor="p-nome"
            obrigatorio
            erro={repetido ? "Já existe um produtor com esse nome." : null}
            className="sm:col-span-2"
          >
            <Input
              id="p-nome"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              maxLength={120}
              required
            />
          </Campo>
          <Campo
            rotulo="CPF ou CNPJ"
            htmlFor="p-doc"
            erro={form.document && docInvalido ? "CPF/CNPJ inválido." : null}
          >
            <Input
              id="p-doc"
              inputMode="numeric"
              value={form.document}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  document: mascaraDocumento(e.target.value),
                }))
              }
              maxLength={18}
            />
          </Campo>
          <Campo rotulo="Telefone" htmlFor="p-tel">
            <Input
              id="p-tel"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((s) => ({ ...s, phone: e.target.value }))
              }
            />
          </Campo>
          <Campo rotulo="E-mail" htmlFor="p-email">
            <Input
              id="p-email"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((s) => ({ ...s, email: e.target.value }))
              }
            />
          </Campo>
          <Campo
            rotulo="Parceiro"
            htmlFor="p-parceiro"
            ajuda="Revenda, cooperativa ou empresa pela qual você atende este produtor."
          >
            <Input
              id="p-parceiro"
              value={form.partner}
              onChange={(e) =>
                setForm((s) => ({ ...s, partner: e.target.value }))
              }
            />
          </Campo>
          <Campo rotulo="Observações" htmlFor="p-obs" className="sm:col-span-2">
            <Textarea
              id="p-obs"
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
        buscaAtiva={Boolean(busca)}
        busca={
          <BuscaDaLista
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar por nome ou CPF/CNPJ..."
          />
        }
        acaoPrincipal={
          podeCriar ? (
            <BotaoNovo
              rotulo="Novo Produtor"
              onClick={() => abrir("novo", false)}
            />
          ) : undefined
        }
      />

      {c.carregando ? (
        <LoadingState />
      ) : c.produtores.length === 0 ? (
        <EmptyStateCard
          icon={UserIcon}
          title="Nenhum produtor cadastrado"
          description="Cadastre os produtores que você atende para organizar as fazendas de cada um."
        />
      ) : (
        <>
          <ItemsCount
            count={lista.length}
            totalCount={c.produtores.length}
            itemLabel="produtor"
            itemLabelPlural="produtores"
            showClearFilters={Boolean(busca)}
            onClearFilters={() => setBusca("")}
          />
          <GradeDeCartoes>
            {lista.map((p) => {
              const n = fazendasPorProdutor.get(p.id) ?? 0;
              const mexe = podeMexer(p);
              return (
                <CartaoDeCadastro
                  key={p.id}
                  titulo={p.name}
                  linhas={[
                    p.document && mascaraDocumento(p.document),
                    [p.phone, p.email].filter(Boolean).join(" · "),
                    `${n} ${n === 1 ? "fazenda" : "fazendas"}`,
                  ]}
                  aoAbrir={() => abrir(p, true)}
                  aoEditar={mexe ? () => abrir(p, false) : undefined}
                  aoExcluir={mexe ? () => void pedirExclusao(p) : undefined}
                />
              );
            })}
          </GradeDeCartoes>
          {lista.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">
              Nenhum produtor encontrado com essa busca.
            </p>
          )}
        </>
      )}

      <DeleteConfirmationDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
        onConfirm={() => void confirmarExclusao()}
        title="Excluir Produtor"
        itemName={excluindo ? `"${excluindo.p.name}"` : undefined}
        loading={apagando}
        cascadeItems={
          excluindo
            ? [
                {
                  label: "Fazendas",
                  count: fazendasPorProdutor.get(excluindo.p.id) ?? 0,
                },
                {
                  label: "Talhões",
                  count: c.talhoes.filter((t) =>
                    c.fazendas.some(
                      (f) =>
                        f.id === t.farm_id && f.producer_id === excluindo.p.id,
                    ),
                  ).length,
                },
                {
                  label: "Lançamentos que perdem o vínculo (não são apagados)",
                  count: excluindo.lancamentos,
                },
              ]
            : undefined
        }
      />
    </div>
  );
}

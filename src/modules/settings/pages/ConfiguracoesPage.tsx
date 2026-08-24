import { lazy, Suspense, useState } from "react";
import ArrowLeft from "~icons/ph/arrow-left";
import WrenchDuotone from "~icons/ph/wrench-duotone";
import TrendDownDuotone from "~icons/ph/trend-down-duotone";
import TrendUpDuotone from "~icons/ph/trend-up-duotone";
import UsersThreeDuotone from "~icons/ph/users-three-duotone";
import BuildingOfficeDuotone from "~icons/ph/building-office-duotone";
import FloppyDiskDuotone from "~icons/ph/floppy-disk-duotone";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/LoadingState";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA } from "@/lib/ui-tokens";
import { useAuth } from "@/contexts/AuthContext";
import { CostCentersManager } from "../components/CostCentersManager";
import { CategoriesManager } from "../components/CategoriesManager";
import { BackupsManager } from "../components/BackupsManager";

// As telas do master são grandes e só o master abre: carregam sob demanda, para
// não entrarem no bundle de quem nunca vai vê-las.
const AdminUsersPage = lazy(
  () => import("@/modules/admin/pages/AdminUsersPage"),
);
const AdminOrgsPage = lazy(() => import("@/modules/admin/pages/AdminOrgsPage"));

type SecaoDeConfig =
  | "centros"
  | "cat-despesa"
  | "cat-receita"
  | "backups"
  | "usuarios"
  | "organizacoes";

interface Atalho {
  id: SecaoDeConfig;
  Icon: typeof WrenchDuotone;
  cor: string;
  titulo: string;
  descricao: string;
  /** Só o master enxerga. */
  master?: boolean;
}

/**
 * Atalhos de Configurações. Ícones duotone coloridos, como no trilho e na tela
 * de Conta — cada assunto com a própria cor, para o olho achar pelo desenho
 * antes de ler o rótulo.
 *
 * As entradas do MASTER moram aqui em vez de terem ícone próprio no trilho: são
 * duas telas que só uma pessoa no mundo abre, e ocupavam permanentemente duas
 * posições de uma coluna que todo usuário vê.
 */
const ATALHOS: Atalho[] = [
  {
    id: "centros",
    Icon: WrenchDuotone,
    cor: "text-emerald-500",
    titulo: "Centros de Custo",
    descricao: "Como você separa as despesas",
  },
  {
    id: "cat-despesa",
    Icon: TrendDownDuotone,
    cor: "text-red-500",
    titulo: "Categorias de Despesa",
    descricao: "Grupos e categorias do que sai",
  },
  {
    id: "cat-receita",
    Icon: TrendUpDuotone,
    cor: "text-teal-500",
    titulo: "Categorias de Receita",
    descricao: "Grupos e categorias do que entra",
  },
  {
    id: "backups",
    Icon: FloppyDiskDuotone,
    cor: "text-sky-500",
    titulo: "Backups",
    descricao: "Consultar, baixar e restaurar",
  },
  {
    id: "usuarios",
    Icon: UsersThreeDuotone,
    cor: "text-fuchsia-500",
    titulo: "Usuários",
    descricao: "Assinantes e acessos do sistema",
    master: true,
  },
  {
    id: "organizacoes",
    Icon: BuildingOfficeDuotone,
    cor: "text-amber-600",
    titulo: "Organizações",
    descricao: "Contas, membros e backups",
    master: true,
  },
];

/**
 * Configurações — HUB de atalhos.
 *
 * Era um conjunto de abas com os três managers. Virou hub em 20/08/2026, no
 * mesmo molde da tela de Conta, para absorver as telas do master: com abas, cada
 * assunto novo espremia os títulos (que já não cabiam no celular e viravam um
 * Select).
 *
 * O conteúdo de cada atalho abre INLINE, substituindo a grade — o mesmo padrão
 * do resto do app (docs/PADRAO-DE-PAGINA.md §6).
 */
export default function ConfiguracoesPage() {
  // `isMaster` vem do contexto (lista em utils/masterUsers), não de um papel na
  // organização — master é operação do produto, não cargo do cliente.
  const { isMaster } = useAuth();
  const [secao, setSecao] = useState<SecaoDeConfig | null>(null);
  const [buscaDeUsuario, setBuscaDeUsuario] = useState("");

  const atalhos = ATALHOS.filter((a) => !a.master || isMaster);

  if (!secao) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {atalhos.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSecao(a.id)}
            className="text-left bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
          >
            <a.Icon className={cn("size-7 shrink-0", a.cor)} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">
                {a.titulo}
              </span>
              <span className="block text-sm text-slate-500">
                {a.descricao}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  const atalho = atalhos.find((a) => a.id === secao)!;

  /**
   * As telas do master desenham a PRÓPRIA barra, porque elas têm um nível a
   * mais (lista → um usuário / uma organização) e o Voltar precisa saber para
   * onde ir. Se o hub também desenhasse a dele, apareceriam dois "Voltar"
   * empilhados fazendo coisas diferentes.
   */
  const desenhaPropriaBarra = secao === "usuarios" || secao === "organizacoes";

  if (desenhaPropriaBarra) {
    return (
      <Suspense fallback={<LoadingState />}>
        {secao === "usuarios" ? (
          <AdminUsersPage
            aoSair={() => setSecao(null)}
            buscaInicial={buscaDeUsuario}
          />
        ) : (
          <AdminOrgsPage
            aoSair={() => setSecao(null)}
            // Editar alguém dentro de uma organização atravessa para a tela de
            // Usuários já buscando por aquele e-mail — em vez de duplicar
            // aquele formulário aqui, o que daria duas telas para divergir.
            aoEditarUsuario={(email) => {
              setBuscaDeUsuario(email);
              setSecao("usuarios");
            }}
          />
        )}
      </Suspense>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 w-full">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSecao(null)}
          className={cn(BOTAO_BARRA, "rounded-md")}
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar
        </Button>

        {/* Assunto à direita, como em Conta: à esquerda ficam as ações, e o
            título é rótulo — não coisa para clicar. */}
        <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
          <atalho.Icon className={cn("size-[18px] shrink-0", atalho.cor)} />
          <span className="truncate">{atalho.titulo}</span>
        </span>
      </div>

      {secao === "centros" && <CostCentersManager />}
      {secao === "backups" && <BackupsManager />}
      {(secao === "cat-despesa" || secao === "cat-receita") && (
        <CategoriesManager
          key={secao}
          direction={secao === "cat-receita" ? "income" : "expense"}
        />
      )}
    </div>
  );
}

import { lazy, Suspense, useState } from "react";
import Plus from "~icons/ph/plus";
import ArrowLeft from "~icons/ph/arrow-left";
import WrenchDuotone from "~icons/ph/wrench-duotone";
// Saída/entrada, e não alta/baixa: a seta que SAI do quadrado é o dinheiro
// que sai. O par trend-up/trend-down falava de tendência, que é outra coisa —
// categoria de despesa não "cai", ela classifica o que sai.
import ArrowSquareOutDuotone from "~icons/ph/arrow-square-out-duotone";
import ArrowSquareInDuotone from "~icons/ph/arrow-square-in-duotone";
import UsersThreeDuotone from "~icons/ph/users-three-duotone";
import BuildingOfficeDuotone from "~icons/ph/building-office-duotone";
import FloppyDiskDuotone from "~icons/ph/floppy-disk-duotone";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/LoadingState";
import { cn } from "@/components/ui/utils";
import { BOTAO_BARRA, BOTAO_BARRA_PRIMARIO } from "@/lib/ui-tokens";
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
  | "backups-master"
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
    Icon: ArrowSquareOutDuotone,
    cor: "text-red-500",
    titulo: "Categorias de Despesa",
    descricao: "Grupos e categorias do que sai",
  },
  {
    id: "cat-receita",
    Icon: ArrowSquareInDuotone,
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
    id: "backups-master",
    Icon: FloppyDiskDuotone,
    cor: "text-slate-500",
    titulo: "Backups de Todos",
    descricao: "Toda organização e toda pessoa",
    master: true,
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
  // Formulário aberto dentro do manager desenha a PRÓPRIA barra (Voltar +
  // Salvar). A do hub some enquanto isso, senão ficam dois "Voltar" empilhados.
  const [formAberto, setFormAberto] = useState(false);
  /**
   * Ação principal da seção aberta, entregue pela própria seção. Guardada como
   * `setAcao(() => fn)` porque `setState` trata função como updater — passar
   * `fn` direto faria o React CHAMAR a ação em vez de guardá-la.
   */
  const [acao, setAcao] = useState<(() => void) | null>(null);
  const [buscaDeUsuario, setBuscaDeUsuario] = useState("");

  const atalhos = ATALHOS.filter((a) => !a.master || isMaster);

  if (!secao) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {atalhos.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setFormAberto(false);
              setAcao(null);
              setSecao(a.id);
            }}
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
      {!formAberto && (
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

          {/* A ação da seção mora AQUI, ao lado do Voltar, e não numa linha só
              dela logo abaixo — uma linha inteira para um botão empurrava a
              lista para baixo sem informar nada. */}
          {acao && (
            <Button
              variant="default"
              onClick={acao}
              className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto")}
            >
              <Plus className="size-4 mr-2" />
              <span className="sm:hidden">Novo Centro</span>
              <span className="hidden sm:inline">Novo Centro de Custo</span>
            </Button>
          )}

          {/* Assunto à direita, como em Conta: à esquerda ficam as ações, e o
            título é rótulo — não coisa para clicar. */}
          <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
            <atalho.Icon className={cn("size-[18px] shrink-0", atalho.cor)} />
            <span className="truncate">{atalho.titulo}</span>
          </span>
        </div>
      )}

      {secao === "centros" && (
        <CostCentersManager
          aoAbrirFormulario={setFormAberto}
          aoRegistrarAcao={setAcao}
        />
      )}
      {secao === "backups" && <BackupsManager />}
      {secao === "backups-master" && <BackupsManager master />}
      {(secao === "cat-despesa" || secao === "cat-receita") && (
        <CategoriesManager
          key={secao}
          direction={secao === "cat-receita" ? "income" : "expense"}
          aoAbrirFormulario={setFormAberto}
        />
      )}
    </div>
  );
}

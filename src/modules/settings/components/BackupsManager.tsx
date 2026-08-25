import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ArrowClockwise from "~icons/ph/arrow-clockwise";
import DownloadSimple from "~icons/ph/download-simple";
import Funnel from "~icons/ph/funnel";
import ArrowCounterClockwise from "~icons/ph/arrow-counter-clockwise";
import FloppyDiskDuotone from "~icons/ph/floppy-disk-duotone";
import CalendarDuotone from "~icons/ph/calendar-duotone";
import CalendarStarDuotone from "~icons/ph/calendar-star-duotone";
import HandDuotone from "~icons/ph/hand-duotone";
import SignOutDuotone from "~icons/ph/sign-out-duotone";
import ShieldWarningDuotone from "~icons/ph/shield-warning-duotone";
import Trash from "~icons/ph/trash";
import GlobeDuotone from "~icons/ph/globe-duotone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { LoadingState } from "@/components/ui/LoadingState";
import { cn } from "@/components/ui/utils";
import { Ajuda } from "@/components/ui/Ajuda";
import {
  BOTAO_BARRA,
  BOTAO_BARRA_PRIMARIO,
  CAMPO_BARRA,
  ICONE_BOTAO_BARRA,
  PAINEL_ESCURO,
  ROTULO_PAINEL_ESCURO,
  SETA_BOTAO_BARRA,
} from "@/lib/ui-tokens";
import { api } from "@/utils/api";

interface Backup {
  id: string;
  escopo: "geral" | "organizacao" | "usuario";
  tipo: "diario" | "mensal" | "manual" | "saida" | "pre-operacao";
  organization_id: string | null;
  user_id: string | null;
  bytes: number;
  contagem: Record<string, number>;
  identidade: Record<string, string | null>;
  criado_em: string;
  expira_em: string | null;
}

interface Previsao {
  total: { repostas: number; sobrescritas: number; intactas: number };
  por_tabela: Record<
    string,
    { repostas: number; sobrescritas: number; intactas: number }
  >;
}

/**
 * Tipos com ÍCONE e COR, no molde dos atalhos de Configurações: o olho acha
 * pelo desenho antes de ler. `saida` e `pre-operacao` em âmbar/vermelho porque
 * são os que aparecem depois de algo grave — quem procura por eles está
 * procurando exatamente por isso.
 */
const MARCAS: Record<
  Backup["tipo"],
  { Icon: typeof CalendarDuotone; cor: string; rotulo: string }
> = {
  diario: { Icon: CalendarDuotone, cor: "text-sky-500", rotulo: "Diário" },
  mensal: {
    Icon: CalendarStarDuotone,
    cor: "text-indigo-500",
    rotulo: "Mensal",
  },
  manual: { Icon: HandDuotone, cor: "text-emerald-500", rotulo: "Manual" },
  saida: { Icon: SignOutDuotone, cor: "text-amber-600", rotulo: "Saída" },
  "pre-operacao": {
    Icon: ShieldWarningDuotone,
    cor: "text-red-500",
    rotulo: "Pré-operação",
  },
};

/**
 * Nomes de tabela não são para o cliente ler. O card mostra o que ele
 * reconhece — lançamento, categoria, centro de custo — e nessa ordem.
 */
const ROTULOS: [string, string, string][] = [
  ["farm_receipts", "lançamento", "lançamentos"],
  ["farm_receipt_items", "item", "itens"],
  ["farm_tasks", "pendência", "pendências"],
  ["farm_recurring_receipts", "recorrência", "recorrências"],
  ["farm_cost_centers", "centro de custo", "centros de custo"],
  ["farm_categories", "categoria", "categorias"],
  ["farms", "fazenda", "fazendas"],
];

function resumo(contagem: Record<string, number>): string {
  const partes = ROTULOS.filter(([k]) => (contagem[k] ?? 0) > 0)
    .slice(0, 3)
    .map(([k, um, muitos]) => {
      const n = contagem[k];
      return `${n} ${n === 1 ? um : muitos}`;
    });
  return partes.length ? partes.join(", ") : "sem movimento";
}

function dataLonga(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tamanho(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type FiltroEscopo = "todos" | "meus" | "organizacao";
type FiltroTipo = "todos" | Backup["tipo"];

/**
 * Tela de backups. MESMO componente para cliente e master, com `master` mudando
 * só o que precisa mudar: a rota (o master não passa pela RLS), os filtros por
 * organização e pessoa, o seletor de alvo ao gerar, e o excluir.
 *
 * Duas telas separadas seriam duas listas, dois cards e dois diálogos de
 * pré-visualização para divergir — e a pré-visualização é a peça que não pode
 * ficar diferente entre quem opera e quem é operado.
 */
export function BackupsManager({ master = false }: { master?: boolean }) {
  const RAIZ = master ? "/admin/backups" : "/backups";
  const [backups, setBackups] = useState<Backup[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [podeRestaurar, setPodeRestaurar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);

  const [fEscopo, setFEscopo] = useState<FiltroEscopo>("todos");
  const [fTipo, setFTipo] = useState<FiltroTipo>("todos");
  // Só master: filtro por texto (e-mail ou organização) e alvo do disparo.
  const [busca, setBusca] = useState("");
  const [alvoEscopo, setAlvoEscopo] = useState<
    "geral" | "organizacao" | "usuario"
  >("geral");
  const [alvoId, setAlvoId] = useState("");
  const [excluindo, setExcluindo] = useState<Backup | null>(null);

  // A restauração é DOIS passos: primeiro pergunta ao servidor o que mudaria,
  // depois confirma com aquele número na frente. Nunca aplica direto.
  const [previsao, setPrevisao] = useState<{
    backup: Backup;
    dados: Previsao;
  } | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{
        backups: Backup[];
        pode_restaurar?: boolean;
        meu_user_id?: string | null;
      }>(RAIZ);
      setBackups(r.backups ?? []);
      // O master não recebe esses dois: ele sempre pode, e não tem "os meus".
      setPodeRestaurar(master ? true : (r.pode_restaurar ?? false));
      setMeuId(r.meu_user_id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar backups");
    } finally {
      setLoading(false);
    }
  }, [RAIZ, master]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(
    () =>
      backups.filter((b) => {
        if (fTipo !== "todos" && b.tipo !== fTipo) return false;
        if (fEscopo === "meus" && b.user_id !== meuId) return false;
        if (fEscopo === "organizacao" && b.escopo !== "organizacao")
          return false;
        if (busca.trim()) {
          // Procura no que o master conhece o alvo por: e-mail e nome da
          // organização, congelados no pacote.
          const q = busca.trim().toLowerCase();
          const alvo = [
            b.identidade?.user_email,
            b.identidade?.user_name,
            b.identidade?.organization_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!alvo.includes(q)) return false;
        }
        return true;
      }),
    [backups, fEscopo, fTipo, meuId, busca],
  );

  const filtrosAtivos =
    (fEscopo !== "todos" ? 1 : 0) +
    (fTipo !== "todos" ? 1 : 0) +
    (busca.trim() ? 1 : 0);

  async function excluir() {
    if (!excluindo) return;
    await api(`/admin/backups/${excluindo.id}`, { method: "DELETE" });
    toast.success("Backup excluído");
    setExcluindo(null);
    await carregar();
  }

  async function gerarAgora() {
    setGerando(true);
    try {
      const r = await api<{
        gravou: boolean;
        contagem: Record<string, number>;
      }>(master ? "/admin/backups/run" : "/backups/run", {
        method: "POST",
        body: master
          ? { escopo: alvoEscopo, id: alvoId || undefined, tipo: "manual" }
          : { escopo: "usuario" },
      });
      // `gravou: false` não é falha: o conteúdo é idêntico ao último backup, e o
      // arquivo anterior continua valendo. Dizer "erro" aqui seria mentira.
      toast.success(
        r.gravou
          ? `Backup criado — ${resumo(r.contagem)}`
          : "Nada mudou desde o último backup; o anterior continua valendo",
      );
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar backup");
    } finally {
      setGerando(false);
    }
  }

  async function baixar(b: Backup) {
    setBaixando(b.id);
    try {
      const r = await api<{ url: string }>(`${RAIZ}/${b.id}/url`);
      window.open(r.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar o link");
    } finally {
      setBaixando(null);
    }
  }

  async function pedirPrevisao(b: Backup) {
    setRestaurando(true);
    try {
      const r = await api<{ resultado: Previsao }>(`${RAIZ}/${b.id}/restore`, {
        method: "POST",
        body: { aplicar: false },
      });
      setPrevisao({ backup: b, dados: r.resultado });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao simular");
    } finally {
      setRestaurando(false);
    }
  }

  async function aplicar() {
    if (!previsao) return;
    const r = await api<{ resultado: Previsao }>(
      `${RAIZ}/${previsao.backup.id}/restore`,
      { method: "POST", body: { aplicar: true } },
    );
    const t = r.resultado.total;
    toast.success(
      `Restaurado — ${t.repostas} reposto(s), ${t.sobrescritas} sobrescrito(s)`,
    );
    setPrevisao(null);
  }

  const t = previsao?.dados.total;

  return (
    <div className="space-y-4">
      {/* 1 — filtros. Sem busca: a lista é curta e o que se procura é uma
          DATA, que já está visível em cada card. */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        <div className="grid flex-1 min-w-0 gap-2 grid-cols-1 sm:grid-cols-2">
          {master && (
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por pessoa ou organização"
              className={cn(CAMPO_BARRA, "w-full")}
            />
          )}
          <Select
            value={fEscopo}
            onValueChange={(v) => setFEscopo(v as FiltroEscopo)}
          >
            <SelectTrigger className={cn(BOTAO_BARRA, "w-full")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os backups</SelectItem>
              {!master && (
                <SelectItem value="meus">Só os meus dados</SelectItem>
              )}
              <SelectItem value="organizacao">
                {master ? "Só por organização" : "Da organização"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={cn(BOTAO_BARRA, "rounded-md")}
            >
              <Funnel className={ICONE_BOTAO_BARRA} />
              Filtros
              {filtrosAtivos > 0 && (
                <span className="ml-1.5 text-xs text-slate-500">
                  ({filtrosAtivos})
                </span>
              )}
              <span className={SETA_BOTAO_BARRA} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn(PAINEL_ESCURO, "w-64")} align="end">
            <div className="space-y-2">
              <span className={ROTULO_PAINEL_ESCURO}>Tipo</span>
              <Select
                value={fTipo}
                onValueChange={(v) => setFTipo(v as FiltroTipo)}
              >
                <SelectTrigger className={cn(BOTAO_BARRA, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(MARCAS).map(([k, m]) => (
                    <SelectItem key={k} value={k}>
                      {m.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 2 — ações. Um botão escuro só. */}
      <header className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
        {/* O master escolhe O QUE gerar; para o cliente, que só tem os
            próprios dados, um seletor de um item seria ruído. */}
        {master && (
          <>
            <Select
              value={alvoEscopo}
              onValueChange={(v) => {
                setAlvoEscopo(v as typeof alvoEscopo);
                setAlvoId("");
              }}
            >
              <SelectTrigger className={cn(BOTAO_BARRA, "lg:w-[190px]")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Banco inteiro</SelectItem>
                <SelectItem value="organizacao">Uma organização</SelectItem>
                <SelectItem value="usuario">Uma pessoa</SelectItem>
              </SelectContent>
            </Select>
            {alvoEscopo !== "geral" && (
              <Input
                value={alvoId}
                onChange={(e) => setAlvoId(e.target.value)}
                placeholder={
                  alvoEscopo === "organizacao"
                    ? "ID da organização"
                    : "ID da pessoa"
                }
                className={cn(CAMPO_BARRA, "lg:w-[300px]")}
              />
            )}
          </>
        )}
        <Button
          variant="default"
          onClick={gerarAgora}
          disabled={
            gerando ||
            !podeRestaurar ||
            (master && alvoEscopo !== "geral" && !alvoId.trim())
          }
          className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 lg:w-auto")}
        >
          <FloppyDiskDuotone className="size-4 mr-2" />
          {gerando ? "Gerando..." : "Gerar Backup Agora"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void carregar()}
          disabled={loading}
          className={cn(BOTAO_BARRA, "rounded-md lg:w-auto")}
        >
          <ArrowClockwise className={ICONE_BOTAO_BARRA} />
          Atualizar
        </Button>
      </header>

      {/* 3 — contador */}
      <div className="flex items-center justify-end gap-1 px-1 min-h-[28px]">
        {/* À ESQUERDA da linha, e não colado no contador: a explicação é da
            tela toda (quando roda, quanto tempo guarda, o que restaurar faz),
            não do número de backups. */}
        <Ajuda className="mr-auto">
          O backup automático roda todo dia de madrugada. Os diários ficam 30
          dias e os mensais, 12 meses. Restaurar repõe o que está no pacote e
          nunca apaga o que você criou depois.
        </Ajuda>
        <span className="text-sm text-slate-500">
          {visiveis.length} {visiveis.length === 1 ? "backup" : "backups"}
          {filtrosAtivos > 0 && ` de ${backups.length}`}
        </span>
        {filtrosAtivos > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFEscopo("todos");
              setFTipo("todos");
              setBusca("");
            }}
            className="h-7 px-2 text-sm font-normal text-slate-500 hover:text-slate-700"
          >
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* 4 — conteúdo, sempre montado */}
      <div
        className={cn(
          "transition-opacity duration-200",
          loading && "opacity-50 pointer-events-none",
        )}
      >
        {loading && backups.length === 0 ? (
          <LoadingState />
        ) : visiveis.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-sm text-slate-700">
              {backups.length === 0
                ? "Nenhum backup ainda."
                : "Nenhum backup com esses filtros."}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {backups.length === 0
                ? "O backup automático roda todo dia de madrugada — o primeiro aparece aqui amanhã."
                : "Limpe os filtros para ver todos."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visiveis.map((b) => {
              const m = MARCAS[b.tipo];
              const daOrg = b.escopo === "organizacao";
              return (
                <div
                  key={b.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3"
                >
                  {b.escopo === "geral" ? (
                    <GlobeDuotone className="size-7 shrink-0 text-slate-500" />
                  ) : (
                    <m.Icon className={cn("size-7 shrink-0", m.cor)} />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {dataLonga(b.criado_em)}
                      <span className="ml-2 font-normal text-slate-500">
                        {hora(b.criado_em)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 truncate">
                      {/* Para o master QUEM é o alvo importa mais que o
                          escopo: ele olha uma lista de gente, não a própria. */}
                      {master
                        ? (b.identidade?.user_email ??
                          b.identidade?.organization_name ??
                          (b.escopo === "geral" ? "Banco inteiro" : "—"))
                        : daOrg
                          ? "Organização"
                          : "Meus dados"}{" "}
                      - {resumo(b.contagem)} - {tamanho(b.bytes)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void baixar(b)}
                      disabled={baixando === b.id}
                      className={cn(BOTAO_BARRA, "rounded-md")}
                    >
                      <DownloadSimple className={ICONE_BOTAO_BARRA} />
                      Baixar
                    </Button>
                    {podeRestaurar && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void pedirPrevisao(b)}
                        disabled={restaurando}
                        className={cn(BOTAO_BARRA, "rounded-md")}
                      >
                        <ArrowCounterClockwise className={ICONE_BOTAO_BARRA} />
                        Restaurar
                      </Button>
                    )}
                    {master && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setExcluindo(b)}
                        className="h-9 px-4 font-normal rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:text-red-800"
                      >
                        <Trash className={ICONE_BOTAO_BARRA} />
                        Excluir
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* A pré-visualização É o diálogo: a pergunta vem com os números já
          calculados pelo servidor, não com uma promessa genérica. */}
      <ConfirmActionDialog
        open={previsao !== null}
        onOpenChange={(o) => {
          if (!o) setPrevisao(null);
        }}
        title="Restaurar este backup?"
        description={
          t
            ? [
                `Backup de ${previsao ? dataLonga(previsao.backup.criado_em) : ""}.`,
                "",
                `${t.repostas} linha(s) voltam (sumiram desde então).`,
                `${t.sobrescritas} linha(s) são sobrescritas (mudaram desde então).`,
                `${t.intactas} ficam como estão.`,
                "",
                "Restaurar nunca apaga: o que existe hoje e não está no backup permanece.",
              ].join("\n")
            : ""
        }
        confirmLabel="Restaurar"
        cancelLabel="Cancelar"
        loadingLabel="Restaurando..."
        onConfirm={aplicar}
      />

      <ConfirmActionDialog
        open={excluindo !== null}
        onOpenChange={(o) => {
          if (!o) setExcluindo(null);
        }}
        title="Excluir este backup?"
        description={
          excluindo
            ? `O arquivo de ${dataLonga(excluindo.criado_em)} sai do R2 e do índice. Não tem como desfazer, e é o único lugar onde aquele estado existia.`
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

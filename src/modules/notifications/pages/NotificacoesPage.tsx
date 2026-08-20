import { useNavigate } from "react-router-dom";
import NotificationsIcon from "~icons/ph/bell";
import Check from "~icons/ph/check";
import DoneAll from "~icons/ph/checks";
import Trash2 from "~icons/ph/trash";
import { Button } from "@/components/ui/button";
import { BOTAO_BARRA, ICONE_BOTAO_BARRA } from "@/lib/ui-tokens";
import { cn } from "@/components/ui/utils";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { useNotifications } from "../hooks/useNotifications";
import type { AppNotification } from "../types";

/** "14:32" hoje, "ontem", senão "12/07". */
/**
 * Cor do card por URGÊNCIA — a mesma linguagem do toast (`richColors`), porque
 * o toast e a linha da lista são a MESMA notificação vista em dois momentos.
 *
 * Três níveis, não quatro: distinguir "vence hoje" de "vence amanhã" por cor
 * seria precisão que o olho não usa, e o texto já diz qual é.
 *
 * SÓ NÃO-LIDA recebe cor. Lida é assunto encerrado — pintar a lista inteira
 * faria a cor deixar de significar "exige atenção" e passar a significar
 * "existe". É o que separa uma caixa de entrada de um arco-íris.
 */
function tomDoCard(kind: string) {
  if (kind === "overdue")
    return { caixa: "bg-red-50 border-red-200", corpo: "text-red-700" };
  if (kind === "due_today" || kind === "due_in_1d")
    return { caixa: "bg-amber-50 border-amber-200", corpo: "text-amber-800" };
  return { caixa: "bg-white border-slate-300", corpo: "text-slate-500" };
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function NotificacoesPage() {
  const {
    notifications,
    unread,
    loading,
    error,
    markRead,
    markAllRead,
    remove,
  } = useNotifications();
  const navigate = useNavigate();

  // Abrir = marcar lida + ir pra origem. Não há deep-link por item ainda, então
  // manda pra lista correspondente.
  function open(n: AppNotification) {
    void markRead(n.id);
    if (n.receipt_id) navigate("/lancamentos");
    else if (n.task_id) navigate("/pendencias");
  }

  return (
    <div className="space-y-4">
      {/* Ação à esquerda, contador à direita — a ordem do padrão de página
          (docs/PADRAO-DE-PAGINA.md): primeiro o que se faz, depois quanto
          sobrou. Aqui não há botão de criar (notificação é produzida pelo
          cron), então "Marcar Todas como Lidas" fica no cinza de barra, e não
          no escuro reservado para criar. */}
      <header className="flex items-center gap-2 min-h-[36px]">
        {unread > 0 && (
          <Button
            variant="ghost"
            onClick={() => void markAllRead()}
            className={cn(BOTAO_BARRA, "gap-1.5 rounded-md")}
          >
            <DoneAll className={ICONE_BOTAO_BARRA} />
            Marcar Todas como Lidas
            {/* Contador em VERMELHO, e não no `BADGE_BOTAO_BARRA` escuro dos
                filtros: aqui o número é um alerta (há coisa esperando), não a
                contagem de um estado que a pessoa mesma ligou.
 
                Branco sobre `red-400`, por escolha do Leonardo (20/08/2026).
                Fica em 2,8:1 e NÃO passa no AA para texto — o que se tolera
                aqui porque o número é redundante: a mesma contagem está escrita
                em "3 Não Lidas", do outro lado do mesmo cabeçalho. Quem não
                conseguir ler o selo não perde a informação.

                Se um dia este selo for para um lugar onde o número NÃO se
                repete, ele precisa escurecer. O sinal forte fica na bolinha do
                sino, no trilho, onde ele compete com o resto da tela; aqui
                dentro, já na página de notificações, ele não precisa gritar. */}
            <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-400 text-white text-[11px] tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          </Button>
        )}
        <div className="flex-1" />
        <span className="text-sm text-slate-500">
          {unread > 0
            ? `${unread} ${unread > 1 ? "Não Lidas" : "Não Lida"}`
            : "Tudo em Dia"}
        </span>
      </header>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyStateCard
          icon={NotificationsIcon}
          title="Nenhuma notificação"
          description="Avisos de contas e lembretes a vencer aparecem aqui."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Row
              key={n.id}
              n={n}
              onOpen={() => open(n)}
              onRead={() => void markRead(n.id)}
              onRemove={() => void remove(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  n,
  onOpen,
  onRead,
  onRemove,
}: {
  n: AppNotification;
  onOpen: () => void;
  onRead: () => void;
  onRemove: () => void;
}) {
  const isUnread = !n.read_at;
  const tom = tomDoCard(n.kind);
  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex items-start gap-3",
        isUnread ? tom.caixa : "bg-white border-slate-200 opacity-70",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left"
      >
        <div
          className={cn(
            "truncate",
            isUnread ? "font-medium text-slate-900" : "text-slate-600",
          )}
        >
          {n.title}
        </div>
        {n.body && (
          <div
            className={cn(
              "text-sm truncate",
              isUnread ? tom.corpo : "text-slate-500",
            )}
          >
            {n.body}
          </div>
        )}
      </button>
      <div className="flex items-center gap-1 shrink-0">
        {/* Quando: mesma caixa dos botões de ação (altura, borda, raio), mas em
            <span>, não <button disabled>. É informação, não ação desativada —
            um botão desabilitado promete um clique que não existe e ainda entra
            na navegação por teclado.

            LARGURA FIXA: `fmtWhen` só produz três formatos, todos de 5
            caracteres — "07:27", "ontem", "18/08" (o ano nunca aparece). Sem
            largura fixa, "ontem" em letras proporcionais encolhia a caixa e a
            coluna de botões dançava de linha para linha. Se algum dia entrar um
            formato mais longo ali, este 72px precisa subir junto. */}
        <span
          className={cn(
            "h-9 w-[72px] inline-flex items-center justify-center rounded-md border border-current/25 bg-white/60 text-sm tabular-nums whitespace-nowrap",
            isUnread ? tom.corpo : "text-slate-500",
          )}
        >
          {fmtWhen(n.created_at)}
        </span>
        {isUnread && (
          <ActionIconButton
            icon={Check}
            label="Marcar como lida"
            onClick={onRead}
          />
        )}
        <ActionIconButton
          icon={Trash2}
          label="Limpar"
          tone="danger"
          onClick={onRemove}
        />
      </div>
    </div>
  );
}

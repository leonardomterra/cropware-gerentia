import { useNavigate } from "react-router-dom";
import NotificationsIcon from "~icons/material-symbols-light/notifications-outline";
import Check from "~icons/material-symbols-light/check";
import DoneAll from "~icons/material-symbols-light/done-all";
import Trash2 from "~icons/material-symbols-light/delete-outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { useNotifications } from "../hooks/useNotifications";
import type { AppNotification } from "../types";

/** "14:32" hoje, "ontem", senão "12/07". */
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function NotificacoesPage() {
  const { notifications, unread, loading, error, markRead, markAllRead, remove } =
    useNotifications();
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
      <header className="flex items-center gap-2">
        <span className="text-sm text-slate-500">
          {unread > 0
            ? `${unread} não lida${unread > 1 ? "s" : ""}`
            : "Tudo em dia"}
        </span>
        <div className="flex-1" />
        {unread > 0 && (
          <Button variant="outline" onClick={() => void markAllRead()}>
            <DoneAll className="size-4 mr-1" />
            Marcar todas como lidas
          </Button>
        )}
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
          description="Avisos de contas e tarefas a vencer aparecem aqui."
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
  const overdue = n.kind === "overdue";
  return (
    <div
      className={cn(
        "bg-white rounded-lg border p-3 flex items-start gap-3",
        isUnread ? "border-slate-300" : "border-slate-200 opacity-70",
      )}
    >
      {/* Ponto de não-lida (vermelho quando vencido). */}
      <span
        className={cn(
          "mt-2 size-2 rounded-full shrink-0",
          isUnread ? (overdue ? "bg-red-500" : "bg-slate-900") : "bg-transparent",
        )}
      />
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className={cn("truncate", isUnread ? "font-medium text-slate-900" : "text-slate-600")}>
          {n.title}
        </div>
        {n.body && (
          <div
            className={cn(
              "text-sm truncate",
              overdue && isUnread ? "text-red-600" : "text-slate-500",
            )}
          >
            {n.body}
          </div>
        )}
      </button>
      <span className="text-xs text-slate-400 shrink-0 mt-0.5">{fmtWhen(n.created_at)}</span>
      <div className="flex items-center gap-1 shrink-0">
        {isUnread && <ActionIconButton icon={Check} label="Marcar como lida" onClick={onRead} />}
        <ActionIconButton icon={Trash2} label="Limpar" tone="danger" onClick={onRemove} />
      </div>
    </div>
  );
}

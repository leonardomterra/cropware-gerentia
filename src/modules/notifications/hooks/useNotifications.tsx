import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/utils/api";
import type { AppNotification } from "../types";

interface ListResponse {
  notifications: AppNotification[];
  unread: number;
}

interface NotificationsCtx {
  notifications: AppNotification[];
  unread: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const Ctx = createContext<NotificationsCtx | null>(null);

/**
 * Estado ÚNICO de notificações — compartilhado pelo badge do menu e pela página.
 *
 * Por que Context e não um hook solto (como o useTasks): com estado por
 * componente, o AppShell e a página teriam listas independentes, e marcar como
 * lida na página NÃO atualizaria o contador do menu.
 *
 * Envolve o <AppShell /> em App.tsx, então cobre a sidebar (badge) e o <Outlet/>
 * (página) de uma vez. Só monta autenticado — o AppShell já exige sessão.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  // IDs já vistos. null = ainda não fizemos a baseline (1ª carga).
  const seenIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      // A rota devolve lista + unread juntos (evita 2ª chamada só pro badge).
      const r = await api<ListResponse>("/notifications", { method: "GET" });
      const list = r.notifications ?? [];

      if (seenIds.current === null) {
        // 1ª carga = só baseline, SEM toast. Senão o usuário abriria o app e
        // levaria um toast por cada não-lida acumulada.
        seenIds.current = new Set(list.map((n) => n.id));
      } else {
        const fresh = list.filter((n) => !n.read_at && !seenIds.current!.has(n.id));
        // Teto de 3 pra não empilhar torre de toasts; o resto vira um resumo.
        for (const n of fresh.slice(0, 3)) {
          const show = n.kind === "overdue" ? toast.warning : toast;
          show(n.title, {
            description: n.body ?? undefined,
            action: { label: "Ver", onClick: () => navigate("/notificacoes") },
          });
        }
        if (fresh.length > 3) {
          toast(`+${fresh.length - 3} novas notificações`, {
            action: { label: "Ver", onClick: () => navigate("/notificacoes") },
          });
        }
        list.forEach((n) => seenIds.current!.add(n.id));
      }

      setNotifications(list);
      setUnread(r.unread ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui carregar");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Revalida ao recuperar o foco (mesmo padrão do PaywallGate): o cron roda de
  // madrugada, então o badge atualiza sem o usuário dar F5.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // As mutações são OTIMISTAS (badge reage na hora) e caem pro refresh em erro.
  const markRead = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id);
      if (!target || target.read_at) return; // já lida: não decrementa à toa
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnread((u) => Math.max(0, u - 1));
      try {
        await api(`/notifications/${id}/read`, { method: "POST" });
      } catch {
        await refresh();
      }
    },
    [notifications, refresh],
  );

  const markAllRead = useCallback(async () => {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    try {
      await api("/notifications/read-all", { method: "POST" });
    } catch {
      await refresh();
    }
  }, [unread, refresh]);

  const remove = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id);
      if (!target) return;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (!target.read_at) setUnread((u) => Math.max(0, u - 1));
      try {
        await api(`/notifications/${id}`, { method: "DELETE" });
      } catch {
        await refresh();
      }
    },
    [notifications, refresh],
  );

  return (
    <Ctx.Provider
      value={{ notifications, unread, loading, error, refresh, markRead, markAllRead, remove }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications(): NotificationsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications precisa estar dentro de <NotificationsProvider>");
  return ctx;
}

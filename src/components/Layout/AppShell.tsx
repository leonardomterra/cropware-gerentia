import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Wifi, WifiOff, Building2, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/lancamentos", label: "Lancamentos" },
  { to: "/fazendas", label: "Fazendas" },
  { to: "/conta", label: "Conta" },
];

/** Estilo glass pra botoes sobre o header colorido (padrao CDM). */
const GLASS: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.25)",
  color: "#ffffff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
};

function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function trialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  return Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000),
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const online = useOnline();
  const days = trialDaysLeft(user?.trialEndsAt);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* HEADER */}
      <header className="shadow-none" style={{ backgroundColor: "#475569" }}>
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile */}
          <div className="flex md:hidden items-center justify-between">
            <Logo className="text-white h-5 w-auto" />
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center rounded p-2 transition-all active:scale-95"
              style={GLASS}
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex items-center justify-between">
            <Logo className="text-white h-6 w-auto shrink-0" />

            <div className="flex items-center gap-3">
              <p
                className="text-white font-medium leading-none"
                style={{ fontSize: "14px" }}
              >
                {user?.fullName}
              </p>
              {days !== null ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded h-8 px-3"
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "#ffffff",
                    fontWeight: 500,
                    fontSize: "12px",
                  }}
                >
                  <Clock className="size-3.5" />
                  {days <= 0
                    ? "Trial encerrado"
                    : `Trial - ${days} ${days === 1 ? "dia" : "dias"}`}
                </span>
              ) : null}
              <button
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded h-8 px-3 transition-all active:scale-95 font-normal text-[14px]"
                style={GLASS}
              >
                <LogOut className="size-3.5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* SUB-HEADER status bar */}
      <div
        className="border-t"
        style={{
          backgroundColor: "#64748b",
          borderTopColor: "rgba(148,163,184,0.45)",
        }}
      >
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-2">
          <div className="flex flex-col md:flex-row md:justify-end items-stretch md:items-center gap-2">
            {user?.organizationName ? (
              <Badge
                className="backdrop-blur-sm gap-1.5 px-2.5 py-1 justify-center md:justify-start"
                style={{
                  backgroundColor: "rgba(51,65,85,0.45)",
                  color: "#ffffff",
                  borderColor: "rgba(100,116,139,0.5)",
                }}
              >
                <Building2 className="size-3.5" />
                <span className="truncate max-w-[150px]">
                  {user.organizationName}
                </span>
              </Badge>
            ) : null}
            <Badge
              className="backdrop-blur-sm gap-1.5 px-2.5 py-1 justify-center md:justify-start"
              style={{
                backgroundColor: online
                  ? "rgba(51,65,85,0.45)"
                  : "rgba(15,23,42,0.85)",
                color: "#ffffff",
                borderColor: "rgba(100,116,139,0.5)",
              }}
            >
              {online ? (
                <Wifi className="size-3.5" />
              ) : (
                <WifiOff className="size-3.5" />
              )}
              <span>{online ? "Online" : "Offline"}</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* TAB BAR - tabs dividem a largura igualmente (flex-1), sem icone */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] w-full mx-auto flex h-12 items-stretch">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex-1 flex items-center justify-center px-3 h-12 whitespace-nowrap text-sm transition-colors",
                  isActive
                    ? "text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                )
              }
              style={({ isActive }) =>
                isActive ? { backgroundColor: "#475569" } : undefined
              }
            >
              {({ isActive }) => (
                <>
                  <span>{item.label}</span>
                  {isActive ? (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: "#334155" }}
                    />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

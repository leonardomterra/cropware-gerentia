import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  Sprout,
  User as UserIcon,
  LogOut,
  Wifi,
  WifiOff,
  Building2,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LogoIcon } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/lancamentos", label: "Lancamentos", icon: Receipt },
  { to: "/fazendas", label: "Fazendas", icon: Sprout },
  { to: "/conta", label: "Conta", icon: UserIcon },
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* HEADER */}
      <header className="shadow-none" style={{ backgroundColor: "#475569" }}>
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Mobile */}
          <div className="flex md:hidden items-center justify-between">
            <LogoIcon className="text-white h-7 w-auto" />
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
            <div className="flex items-center">
              <LogoIcon className="text-white h-9 w-auto shrink-0" />
              <div
                className="mx-3"
                style={{
                  width: "1px",
                  height: "24px",
                  background:
                    "linear-gradient(to bottom, transparent, rgba(255,255,255,0.35) 30%, rgba(255,255,255,0.35) 70%, transparent)",
                }}
              />
              <p
                style={{
                  fontFamily: "'Alumni Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.9)",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                }}
              >
                Farm Data<span style={{ color: "#cbd5e1" }}>.</span>
                <br />
                <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>
                  Smart Decisions.
                </span>
              </p>
            </div>

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

      {/* TAB BAR */}
      <div className="bg-white border-b border-slate-200 overflow-x-auto">
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-4 flex h-12 items-stretch">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center justify-center gap-1.5 px-5 h-12 whitespace-nowrap text-sm transition-colors",
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
                  <item.icon className="size-4" />
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

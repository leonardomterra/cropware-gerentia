import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  Sprout,
  User as UserIcon,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function UserMenu() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  const firstName = user.fullName.split(" ")[0] || "Voce";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-2 text-white hover:bg-white/15 hover:text-white"
        >
          <div className="size-8 rounded-full bg-white text-farm-primary text-sm font-medium flex items-center justify-center">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:inline text-sm">{firstName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-900">
              {user.fullName}
            </span>
            <span className="text-sm text-slate-500 truncate">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut();
          }}
          className="text-red-600 focus:text-red-700 focus:bg-red-50"
        >
          <LogOut className="size-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header unico de ponta a ponta */}
      <header className="bg-farm-primary px-4 sm:px-6 h-14 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Logo className="text-white h-5 w-auto shrink-0" />
          {user?.organizationName ? (
            <>
              <span className="hidden sm:inline-block h-5 w-px bg-white/30" />
              <span className="hidden sm:inline text-white/90 text-sm truncate">
                {user.organizationName}
              </span>
            </>
          ) : null}
        </div>
        <UserMenu />
      </header>

      {/* Barra de menus horizontal */}
      <nav className="bg-white border-b border-slate-200 px-2 sm:px-4 shrink-0">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-3 text-sm transition-colors whitespace-nowrap border-b-2 -mb-px",
                  isActive
                    ? "border-farm-primary text-farm-primary font-medium"
                    : "border-transparent text-slate-600 hover:text-slate-900",
                )
              }
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}

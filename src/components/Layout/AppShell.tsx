import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  Sprout,
  User as UserIcon,
  Menu,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-2 py-3">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              isActive
                ? "bg-farm-green text-white"
                : "text-slate-700 hover:bg-farm-cream",
            )
          }
        >
          <item.icon className="size-4" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function FarmBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="px-4 py-4 border-b border-slate-200">
      <h1 className="text-base font-semibold text-farm-green-dark leading-tight">
        Cropware Farm
      </h1>
      {subtitle ? (
        <p className="text-xs text-farm-soil mt-0.5 truncate">{subtitle}</p>
      ) : null}
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  const firstName = user.fullName.split(" ")[0] || "Voce";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <div className="size-7 rounded-full bg-farm-green text-white text-xs font-medium flex items-center justify-center">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:inline text-sm text-slate-700">
            {firstName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-900">
              {user.fullName}
            </span>
            <span className="text-xs text-slate-500 truncate">{user.email}</span>
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

export function AppShell({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-farm-cream">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-slate-200 shrink-0">
        <FarmBrand subtitle={user?.organizationName} />
        <NavList />
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile menu trigger */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Abrir menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <FarmBrand subtitle={user?.organizationName} />
                <NavList onNavigate={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="md:hidden min-w-0">
              <p className="text-sm font-semibold text-farm-green-dark leading-tight">
                Cropware Farm
              </p>
              {user?.organizationName ? (
                <p className="text-xs text-farm-soil truncate">
                  {user.organizationName}
                </p>
              ) : null}
            </div>
          </div>

          <UserMenu />
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

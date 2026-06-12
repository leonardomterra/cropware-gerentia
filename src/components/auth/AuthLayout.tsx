import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { LogoWordmark } from "@/components/LogoWordmark";

interface AuthLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Shell das telas de auth (login, signup, forgot, reset). Layout split-screen:
 * painel esquerdo escuro com a marca, painel direito com o formulario. Portado
 * do modelo do nxsagr, recolorido da paleta slate dele pra zinc do gerentia
 * (zinc-900/800/700 = farm-primary darkest/darker/dark). No mobile o painel
 * esquerdo some e a marca aparece compacta acima do conteudo.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen w-full flex items-stretch bg-white">
      {/* Painel esquerdo — branding (claro: branco -> cinza claro) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center gap-5 border-r border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 p-12">
        <Logo className="h-16 w-auto" />
        <LogoWordmark className="[--logo-size:30px]" />
      </div>

      {/* Painel direito — conteudo */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px] space-y-6">
          {/* Marca compacta no mobile (painel esquerdo escondido) */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-2">
            <Logo className="h-12 w-auto opacity-90" />
            <LogoWordmark className="[--logo-color:#52525b] [--logo-size:22px]" />
          </div>

          {(title || subtitle) && (
            <div className="space-y-1">
              {title && (
                <h1
                  className="text-slate-900"
                  style={{ fontSize: "16px", fontWeight: 600 }}
                >
                  {title}
                </h1>
              )}
              {subtitle && (
                <p style={{ fontSize: "14px", color: "#a1a1aa" }}>{subtitle}</p>
              )}
            </div>
          )}

          {children}
        </div>
      </div>
    </main>
  );
}

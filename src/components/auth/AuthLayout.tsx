import type { MouseEvent, ReactNode } from "react";
import ArrowUpRight from "~icons/ph/arrow-up-right";
import { Logo, LogoName } from "@/components/Logo";
import { cn } from "@/components/ui/utils";
import { openExternalUrl } from "@/utils/nativeExport";

interface AuthLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

const SITE_CROPWARE = "https://cropware.com.br";

/** No app nativo o link abre no navegador do sistema, e não dentro do app. */
function abrirFora(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  void openExternalUrl(e.currentTarget.href);
}

/**
 * "Ecossistema Cropware" no visual do site (cropware-site, global.css):
 * rótulo em Space Mono caixa alta com o ponto lima (`.eyebrow.has-dot`), a
 * logo da Cropware e o endereço com o grifo lima (`.hl`). Lima #B3FF34 é o
 * acento da marca; grafite #3C3C42 é a cor da logo.
 */
function SeloCropware({ compacto = false }: { compacto?: boolean }) {
  return (
    <a
      href={SITE_CROPWARE}
      target="_blank"
      rel="noopener"
      onClick={abrirFora}
      aria-label="Ecossistema Cropware — cropware.com.br"
      className={cn(
        "group flex items-center",
        compacto ? "flex-col gap-2" : "flex-col items-start gap-3",
      )}
    >
      <span className="inline-flex items-center gap-2.5 font-['Space_Mono',ui-monospace,monospace] text-[11px] tracking-[0.06em] text-[#4C4C52]">
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-[#B3FF34] shadow-[0_0_0_3px_rgba(179,255,52,0.35)]"
        />
        Ecossistema
      </span>
      <span className="flex items-center gap-3">
        <img
          src="/cropware-lockup.svg"
          alt="Cropware"
          className={compacto ? "h-4 w-auto" : "h-5 w-auto"}
        />
        {!compacto && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[#3C3C42]">
            <span className="px-1 rounded-sm bg-[linear-gradient(transparent_14%,#B3FF34_14%,#B3FF34_90%,transparent_90%)]">
              cropware.com.br
            </span>
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        )}
      </span>
    </a>
  );
}

/**
 * Shell das telas de auth (login, signup, forgot, reset). Split-screen: à
 * esquerda o símbolo e, no rodapé, o selo do ecossistema Cropware; à direita
 * o nome "gerentia.app" em cima do formulário. No mobile o painel esquerdo
 * some: símbolo e nome ficam acima do formulário e o selo, abaixo.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen w-full flex items-stretch bg-white">
      {/* Painel esquerdo — marca */}
      <div className="hidden lg:flex lg:w-1/2 flex-col border-r border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-12 py-10">
        <div className="flex-1 flex items-center justify-center">
          <Logo className="h-24" />
        </div>
        <SeloCropware />
      </div>

      {/* Painel direito — conteúdo */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px] space-y-6">
          <div className="flex flex-col items-center lg:items-start gap-3 mb-8">
            <Logo className="lg:hidden h-12" />
            <LogoName className="h-6 lg:h-7" />
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
                <p style={{ fontSize: "14px", color: "#a3a3a3" }}>{subtitle}</p>
              )}
            </div>
          )}

          {children}

          <div className="lg:hidden flex justify-center pt-6">
            <SeloCropware compacto />
          </div>
        </div>
      </div>
    </main>
  );
}

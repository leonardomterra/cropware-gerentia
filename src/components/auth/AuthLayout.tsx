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
 * Card da Cropware, numa linha, no visual das faixas lima do site
 * (cropware-site: `.cw-art bg-volt` + `.cw-tex.is-lime`): fundo lima #B3FF34
 * com o relevo topográfico do Cropware Studio por cima em "sobrepor" (o
 * arquivo é cinza neutro, então desenha relevo claro/escuro sem mudar a cor).
 * Logo da Cropware em grafite à esquerda e "conheça mais em cropware.com.br"
 * à direita.
 */
function SeloCropware({ className }: { className?: string }) {
  return (
    <a
      href={SITE_CROPWARE}
      target="_blank"
      rel="noopener"
      onClick={abrirFora}
      aria-label="Conheça mais em cropware.com.br"
      className={cn(
        "group relative isolate overflow-hidden flex items-center gap-4 h-14 px-5 rounded-2xl bg-[#B3FF34] text-[#19191D] transition-shadow hover:shadow-[0_18px_40px_-16px_rgba(25,25,29,0.35)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-[0.42] mix-blend-overlay"
        style={{ backgroundImage: "url(/textures/cropware-relevo.webp)" }}
      />
      <img
        src="/cropware-lockup.svg"
        alt="Cropware"
        className="h-[18px] w-auto"
      />
      <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[#19191D]">
        <span className="hidden sm:inline">
          <span className="font-normal text-[#2B2B30]">conheça mais em </span>
          cropware.com.br
        </span>
        <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

/**
 * Shell das telas de auth (login, signup, forgot, reset). Split-screen: à
 * esquerda o símbolo e, no rodapé, o card da Cropware; à direita
 * o nome "gerentia.app" em cima do formulário. No mobile o painel esquerdo
 * some: símbolo e nome ficam acima do formulário e o card, abaixo.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen w-full flex items-stretch bg-white">
      {/* Painel esquerdo — marca */}
      <div className="hidden lg:flex lg:w-1/2 flex-col border-r border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-12 py-10">
        <div className="flex-1 flex items-center justify-center">
          <Logo className="h-24" />
        </div>
        <SeloCropware className="w-full max-w-md mx-auto" />
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

          <SeloCropware className="lg:hidden mt-10" />
        </div>
      </div>
    </main>
  );
}

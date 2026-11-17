import type { MouseEvent, ReactNode } from "react";
import ArrowUpRight from "~icons/ph/arrow-up-right";
import InstagramLogo from "~icons/ph/instagram-logo";
import LinkedinLogo from "~icons/ph/linkedin-logo";
import { Logo, LogoName } from "@/components/Logo";
import { openExternalUrl } from "@/utils/nativeExport";

interface AuthLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Cropware, a empresa por trás do gerentia. Textos e links vêm do site
 * (cropware-site, src/data/site.ts e Footer.astro) — manter os dois iguais.
 */
const CROPWARE = {
  site: "https://cropware.com.br",
  frase:
    "Os instrumentos do campo, agora inteligentes. Startup de ferramentas para o agro, de Rio Verde — GO.",
  outros: [
    {
      nome: "Coreflow",
      descricao: "Aferição de vazão de bicos de pulverização",
      href: "https://cropware.com.br/coreflow",
    },
    {
      nome: "Projetos sob medida",
      descricao: "Software e agronomia para a sua operação",
      href: "https://cropware.com.br/servicos",
    },
  ],
  redes: [
    {
      nome: "Instagram",
      Icon: InstagramLogo,
      href: "https://www.instagram.com/cropware.tech/",
    },
    {
      nome: "LinkedIn",
      Icon: LinkedinLogo,
      href: "https://www.linkedin.com/company/cropware-app/",
    },
  ],
};

/** No app nativo o link abre no navegador do sistema, e não dentro do app. */
function abrirFora(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  void openExternalUrl(e.currentTarget.href);
}

function LinkExterno({
  href,
  className,
  children,
  ...rest
}: {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      onClick={abrirFora}
      className={className}
      {...rest}
    >
      {children}
    </a>
  );
}

/** Bloco "faz parte do ecossistema Cropware" — rodapé do painel da marca. */
function EcossistemaCropware() {
  return (
    <div className="w-full max-w-md space-y-5">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Faz parte do ecossistema</p>
        <LinkExterno
          href={CROPWARE.site}
          aria-label="Cropware — cropware.com.br"
          className="block w-fit"
        >
          <img
            src="/cropware-lockup.svg"
            alt="Cropware"
            className="h-6 w-auto"
          />
        </LinkExterno>
        <p className="text-sm text-slate-600 leading-relaxed text-pretty">
          {CROPWARE.frase}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CROPWARE.outros.map((o) => (
          <LinkExterno
            key={o.nome}
            href={o.href}
            className="group rounded-lg border border-slate-200 bg-white/70 p-3 hover:border-slate-300 hover:bg-white transition-colors"
          >
            <span className="flex items-center gap-1 text-sm font-medium text-[#3C3C42]">
              {o.nome}
              <ArrowUpRight className="size-3.5 text-slate-400 group-hover:text-slate-600" />
            </span>
            <span className="block mt-0.5 text-xs text-slate-500 leading-snug">
              {o.descricao}
            </span>
          </LinkExterno>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <LinkExterno
          href={CROPWARE.site}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#3C3C42] hover:underline underline-offset-4"
        >
          cropware.com.br
          <ArrowUpRight className="size-3.5" />
        </LinkExterno>
        <div className="flex items-center gap-1.5">
          {CROPWARE.redes.map((r) => (
            <LinkExterno
              key={r.nome}
              href={r.href}
              aria-label={r.nome}
              className="inline-flex items-center justify-center size-8 rounded-md text-slate-500 hover:bg-slate-200/60 hover:text-[#3C3C42] transition-colors"
            >
              <r.Icon className="size-[18px]" />
            </LinkExterno>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Shell das telas de auth (login, signup, forgot, reset). Split-screen: à
 * esquerda a marca (gerentia em cima, ecossistema Cropware no rodapé), à
 * direita o formulário. No mobile o painel esquerdo some: a marca aparece
 * compacta acima do formulário e a Cropware numa linha abaixo dele.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen w-full flex items-stretch bg-white">
      {/* Painel esquerdo — marca */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center border-r border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-12 py-10">
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <Logo className="h-20" />
          <LogoName className="h-9" />
        </div>
        <EcossistemaCropware />
      </div>

      {/* Painel direito — conteúdo */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[380px] space-y-6">
          {/* Marca compacta no mobile (painel esquerdo escondido) */}
          <div className="lg:hidden flex flex-col items-center gap-3 mb-2">
            <Logo className="h-12" />
            <LogoName className="h-6" />
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

          {/* Cropware no mobile: uma linha, sem competir com o formulário. */}
          <LinkExterno
            href={CROPWARE.site}
            className="lg:hidden flex items-center justify-center gap-2 pt-4 text-xs text-slate-500"
          >
            Faz parte do ecossistema
            <img
              src="/cropware-lockup.svg"
              alt="Cropware"
              className="h-3.5 w-auto"
            />
          </LinkExterno>
        </div>
      </div>
    </main>
  );
}

import type { MouseEvent, ReactNode } from "react";
import { openExternalUrl } from "@/utils/nativeExport";

/**
 * Link para fora do app (site da Cropware, termos, privacidade). No web abre
 * em nova aba; no app nativo, no navegador do sistema — e não dentro do app.
 */
function abrirFora(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  void openExternalUrl(e.currentTarget.href);
}

export function LinkExterno({
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

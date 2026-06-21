import { Component, type ErrorInfo, type ReactNode } from "react";
import AlertTriangle from "~icons/material-symbols-light/warning-outline";
import RefreshCw from "~icons/material-symbols-light/refresh";
import Copy from "~icons/material-symbols-light/content-copy-outline";
import Check from "~icons/material-symbols-light/check";
import Home from "~icons/material-symbols-light/home-outline";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
  errorId: string;
}

/**
 * Código curto e DETERMINÍSTICO por tipo de erro (mesmo erro → mesmo código),
 * derivado de name + message + primeira linha do stack. Serve de identificador
 * pra correlacionar: o usuário manda "ERR-XXXX" e nós achamos no console/log.
 */
export function errorIdFor(error: Error | null): string {
  const sig = error
    ? `${error.name}|${error.message}|${(error.stack || "").split("\n")[1] || ""}`
    : "unknown";
  let h = 0;
  for (let i = 0; i < sig.length; i++) h = (Math.imul(31, h) + sig.charCodeAt(i)) | 0;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let n = Math.abs(h) || 1;
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += chars[n % chars.length];
    n = Math.floor(n / chars.length);
  }
  return "ERR-" + out;
}

/** Texto completo (pra copiar/log) — o que ajuda a resolver de fato. */
export function errorDetails(error: Error | null, errorId: string): string {
  if (!error) return `ID: ${errorId}`;
  return [
    `ID: ${errorId}`,
    `${error.name}: ${error.message}`,
    "",
    error.stack || "",
  ].join("\n");
}

interface FallbackProps {
  error: Error | null;
  errorId: string;
  copied: boolean;
  onCopy: () => void;
  onHome: () => void;
  onReload: () => void;
}

/** Tela de erro (apresentacional) — reusada pelo boundary e pela página de teste. */
export function ErrorFallback({
  error,
  errorId,
  copied,
  onCopy,
  onHome,
  onReload,
}: FallbackProps) {
  const title = error?.name || "Erro";
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-[440px] w-full space-y-3">
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex flex-col items-center text-center gap-2.5">
            <AlertTriangle className="size-5 text-amber-400" />
            <h1 className="text-base font-medium text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500 -mt-1">
              Ocorreu um erro inesperado. Tente recarregar.
            </p>
            <span className="mt-1 inline-flex items-center border border-amber-200 bg-amber-50 rounded-md px-2 py-0.5 font-mono text-[13px] text-amber-700">
              {errorId}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onHome} className="h-10 flex-1 gap-1.5">
            <Home className="size-4" />
            Início
          </Button>
          <Button variant="outline" onClick={onCopy} className="h-10 flex-1 gap-1.5">
            {copied ? (
              <>
                <Check className="size-4 text-green-500" />
                <span className="text-green-600">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copiar
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onReload} className="h-10 flex-1 gap-1.5">
            <RefreshCw className="size-4" />
            Recarregar
          </Button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    copied: false,
    errorId: "",
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorId: errorIdFor(error) };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Loga com o código pra dar pra achar quando o usuário reportar "ERR-XXXX".
    console.error(`[${errorIdFor(error)}] Uncaught error:`, error, errorInfo);
  }

  private handleReload = () => window.location.reload();
  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleCopy = () => {
    const { error, errorId } = this.state;
    navigator.clipboard
      .writeText(errorDetails(error, errorId))
      .then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      })
      .catch(() => {});
  };

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          copied={this.state.copied}
          onCopy={this.handleCopy}
          onHome={this.handleGoHome}
          onReload={this.handleReload}
        />
      );
    }
    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Copy, Check, Home } from "lucide-react";
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

function generateErrorId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return (
    "ERR-" +
    Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("")
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
    return { hasError: true, error, errorId: generateErrorId() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleCopy = () => {
    const { error, errorId } = this.state;
    const text = `ID: ${errorId}\n${error?.toString() || ""}`;
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      const { error, copied, errorId } = this.state;
      const errorText = error?.toString() || "";

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-farm-cream p-6">
          <div className="max-w-[640px] w-full space-y-3">
            <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-6">
              <div className="flex flex-col items-center text-center gap-3">
                <AlertTriangle className="size-7 text-amber-400" />
                <div>
                  <h1 className="text-lg font-medium text-slate-900">
                    Algo deu errado
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Ocorreu um erro inesperado. Tente recarregar a pagina.
                  </p>
                </div>
              </div>

              {!!errorText && (
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-slate-900">
                    Detalhes tecnicos
                  </p>
                  <p className="text-xs font-mono text-slate-500 break-all leading-relaxed">
                    {errorText}
                  </p>
                  {error?.stack && (
                    <pre className="text-left text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                      {error.stack}
                    </pre>
                  )}
                  <div className="flex justify-center">
                    <span
                      className="inline-flex items-center border border-amber-200 bg-amber-50 rounded-md px-2 py-0.5 font-mono font-light text-amber-700"
                      style={{ fontSize: "13px" }}
                    >
                      {errorId}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="h-10 gap-2"
              >
                <Home className="size-4" />
                Ir pro inicio
              </Button>
              {!!errorText && (
                <Button
                  variant="outline"
                  onClick={this.handleCopy}
                  className="h-10 gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 text-green-500" />
                      <span className="text-green-600">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copiar detalhes
                    </>
                  )}
                </Button>
              )}
              <Button onClick={this.handleReload} variant="default" className="h-10 gap-2">
                <RefreshCw className="size-4" />
                Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { useState } from "react";
import Chat from "~icons/material-symbols-light/chat-outline";
import ContentCopy from "~icons/material-symbols-light/content-copy-outline";
import Check from "~icons/material-symbols-light/check";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { api } from "@/utils/api";

/** Botao discreto de copiar com feedback rapido (vira um check por ~1,5s). */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponivel: ignora silenciosamente */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className="shrink-0 flex size-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
    >
      {copied ? (
        <Check className="size-4 text-green-600" />
      ) : (
        <ContentCopy className="size-4" />
      )}
    </button>
  );
}

interface GenerateCodeResponse {
  code: string;
  expires_at: string;
}

/** Numero oficial do bot do gerentia.app pra onde o usuario envia o codigo. */
const GERENTIA_WHATSAPP_NUMBER = "+55 64 93618-0235";
/** Mesmo numero so com digitos, no formato que o wa.me espera (DDI + DDD + numero). */
const GERENTIA_WHATSAPP_DIGITS = "5564936180235";

/**
 * Card de vinculo do WhatsApp. Gera um codigo de 6 digitos que o usuario envia
 * pro bot pra associar o telefone a esta conta. O backend
 * (POST /integrations/generate-code) grava em farm_whatsapp_link_codes.
 */
export function WhatsAppLinkCard({ className }: { className?: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = await api<GenerateCodeResponse>("/integrations/generate-code", {
        method: "POST",
        body: {},
      });
      setCode(r.code);
    } catch {
      setError("Não foi possível gerar o código agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={cn("bg-white rounded-lg border border-slate-200 p-5", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 shrink-0">
            <Chat className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-slate-900">WhatsApp</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Vincule seu WhatsApp para lançar recibos por foto direto no chat.
            </p>
          </div>
        </div>
        {!code && (
          <Button
            onClick={generate}
            disabled={loading}
            className="shrink-0 self-start sm:self-auto"
          >
            {loading ? "Gerando..." : "Gerar Código de Vínculo"}
          </Button>
        )}
      </div>

      {code && (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Código de vínculo</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">
                  {code}
                </p>
              </div>
              <CopyButton value={code} label="Copiar código" />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Número do gerentia.app</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">
                  {GERENTIA_WHATSAPP_NUMBER}
                </p>
              </div>
              <CopyButton value={GERENTIA_WHATSAPP_NUMBER} label="Copiar número" />
            </div>
          </div>

          <p className="text-[13px] text-slate-500">
            Envie este código para o WhatsApp do gerentia.app. Válido por 10 minutos.
          </p>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={generate} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Outro Código"}
            </Button>
            <Button asChild className="shrink-0">
              <a
                href={`https://wa.me/${GERENTIA_WHATSAPP_DIGITS}?text=${encodeURIComponent(code)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </section>
  );
}

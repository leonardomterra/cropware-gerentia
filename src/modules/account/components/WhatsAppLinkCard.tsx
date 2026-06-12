import { useState } from "react";
import Chat from "~icons/material-symbols-light/chat-outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { api } from "@/utils/api";

interface GenerateCodeResponse {
  code: string;
  expires_at: string;
}

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
        <div className="space-y-3 mt-4">
          <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <span className="font-mono text-2xl tracking-[0.4em] text-slate-900">
              {code}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Envie este código para o WhatsApp do gerentia.app. Válido por 10 minutos.
          </p>
          <Button variant="outline" onClick={generate} disabled={loading}>
            {loading ? "Gerando..." : "Gerar Outro Código"}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </section>
  );
}

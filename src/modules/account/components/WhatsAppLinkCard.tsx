import { useState } from "react";
import { Button } from "@/components/ui/button";
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
export function WhatsAppLinkCard() {
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
      setError("Nao foi possivel gerar o codigo agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4">
      <h2 className="text-sm font-medium text-slate-900 mb-1">WhatsApp</h2>
      <p className="text-sm text-slate-500 mb-3">
        Vincule seu WhatsApp para lancar recibos por foto direto no chat.
      </p>

      {code ? (
        <div className="space-y-3">
          <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <span className="font-mono text-2xl tracking-[0.4em] text-slate-900">
              {code}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Envie este codigo para o WhatsApp da Cropware Farm. Valido por 10 minutos.
          </p>
          <Button variant="outline" onClick={generate} disabled={loading}>
            {loading ? "Gerando..." : "Gerar outro codigo"}
          </Button>
        </div>
      ) : (
        <Button onClick={generate} disabled={loading}>
          {loading ? "Gerando..." : "Gerar codigo de vinculo"}
        </Button>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </section>
  );
}

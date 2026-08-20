import { useState } from "react";
import CopyDuotone from "~icons/ph/copy-duotone";
import CheckCircleDuotone from "~icons/ph/check-circle-duotone";
import SealCheck from "~icons/ph/seal-check";
import WarningDuotone from "~icons/ph/warning-duotone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BOTAO_BARRA, BOTAO_BARRA_PRIMARIO } from "@/lib/ui-tokens";
import { useAuth } from "@/contexts/AuthContext";
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
      className={cn(
        "shrink-0 flex size-9 items-center justify-center rounded-md border border-slate-200 transition-colors",
        copied
          ? "border-emerald-200 bg-emerald-50"
          : "hover:bg-slate-100 hover:border-slate-300",
      )}
    >
      {/* Duotone colorido, e maior: o ícone é a única pista de que a caixa faz
          alguma coisa — no cinza fino de 16px ele lia como enfeite do card.
          Verde por ser a cor do WhatsApp, que é o assunto desta tela.

          Copiado troca o ÍCONE (cópia → visto) e a MOLDURA, não só o tom: com
          os dois estados em verde, a cor sozinha não avisaria nada. */}
      {copied ? (
        <CheckCircleDuotone className="size-5 text-emerald-700" />
      ) : (
        <CopyDuotone className="size-5 text-emerald-500" />
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
  const { user } = useAuth();
  // UM número por conta: ao confirmar um vínculo novo, o backend apaga o
  // anterior (ver tryLinkByCode em handlers/whatsapp.ts). Por isso o rótulo
  // pode dizer "Alterar" — antes ele acumulava, e dizia.
  const vinculado = !!user?.whatsappLinked;
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
    <section
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-5",
        className,
      )}
    >
      {/* Sem cabeçalho de ícone+título: a sub-página da Conta já diz que o
          assunto é WhatsApp, e repetir punha o mesmo título duas vezes. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 space-y-2">
          {/* STATUS primeiro: a pergunta que traz alguém a esta tela é "está
              ligado?", e a resposta vinha só implícita, na existência ou não do
              botão de gerar código. */}
          <Badge colorScheme={vinculado ? "emerald" : "amber"}>
            {vinculado ? <SealCheck /> : <WarningDuotone />}
            {vinculado ? "Vinculado" : "Não vinculado"}
          </Badge>
          <p className="text-sm text-slate-500">
            {vinculado
              ? "Seu WhatsApp está ligado à conta: dá para lançar recibos por foto direto no chat. Vincular outro número substitui este."
              : "Vincule seu WhatsApp para lançar recibos por foto direto no chat."}
          </p>
        </div>
        {!code && (
          <Button
            variant={vinculado ? "ghost" : "default"}
            onClick={generate}
            disabled={loading}
            className={cn(
              vinculado
                ? cn(BOTAO_BARRA, "rounded-md")
                : cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto"),
              "shrink-0 self-start sm:self-auto",
            )}
          >
            {loading
              ? "Gerando..."
              : vinculado
                ? "Alterar Número"
                : "Gerar Código de Vínculo"}
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
              <CopyButton
                value={GERENTIA_WHATSAPP_NUMBER}
                label="Copiar número"
              />
            </div>
          </div>

          <p className="text-sm text-slate-500">
            Envie este código para o WhatsApp do gerentia.app. Válido por 10
            minutos.
          </p>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="ghost"
              onClick={generate}
              disabled={loading}
              className={cn(BOTAO_BARRA, "rounded-md")}
            >
              {loading ? "Gerando..." : "Gerar Outro Código"}
            </Button>
            <Button
              asChild
              className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto shrink-0")}
            >
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

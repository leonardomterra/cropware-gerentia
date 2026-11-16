import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { modulosComDireito, moduloPorId, type ModuloId } from "@/lib/modulos";
import { SubscriptionCard } from "@/modules/account/components/SubscriptionCard";

/**
 * Gate POR MÓDULO — embrulha as telas de um módulo (ver lib/modulos.ts).
 *
 * Complementa o PaywallGate, não o substitui: o PaywallGate continua travando o
 * app inteiro quando não há trial nem assinatura nenhuma. Este aqui só entra em
 * cena quando a org tem direito a ALGUM módulo, mas não a este — por exemplo,
 * assina o Field e abre uma tela do Finanças.
 *
 * Mesmas regras do PaywallGate:
 *   - FAIL-OPEN: módulos não calculados (null) contam como Finanças liberado;
 *   - MASTER nunca é bloqueado.
 *
 * Lê os módulos do /auth/me (AuthContext) e não do /billing/subscription: este
 * gate monta a cada troca de tela, e buscar a cobrança a cada navegação seria
 * uma requisição a mais por clique.
 */
export function ModuloGate({
  modulo,
  children,
}: {
  modulo: ModuloId;
  children: ReactNode;
}) {
  const { user, isMaster, refreshUser } = useAuth();

  if (isMaster) return <>{children}</>;
  if (modulosComDireito(user?.modules).includes(modulo)) return <>{children}</>;

  const { nome } = moduloPorId(modulo);
  return (
    <div className="mx-auto max-w-lg py-10 space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">
          O módulo {nome} não está na sua assinatura
        </h1>
        <p className="text-sm text-slate-600">
          Assine o {nome} para usar estas telas.
        </p>
      </div>
      {/* Hoje só o Finanças tem planos à venda; o cartão do Field entra quando
          os planos dele existirem. */}
      {modulo === "financas" && <SubscriptionCard />}
      <button
        type="button"
        onClick={() => void refreshUser()}
        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
      >
        Já assinei — atualizar
      </button>
    </div>
  );
}

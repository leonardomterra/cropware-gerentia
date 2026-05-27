import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { WhatsAppLinkCard } from "../components/WhatsAppLinkCard";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  const trial = user.trialEndsAt
    ? new Date(user.trialEndsAt).toLocaleDateString("pt-BR")
    : "-";

  return (
    <div className="max-w-2xl space-y-4">
      <header>
        <h1 className="text-base font-medium text-slate-900">Conta</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Perfil, assinatura e integracoes.
        </p>
      </header>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-medium text-slate-900 mb-3">Perfil</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <div>
            <dt className="text-slate-500">Nome</dt>
            <dd className="text-slate-900">{user.fullName || "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">E-mail</dt>
            <dd className="text-slate-900 truncate">{user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Role</dt>
            <dd className="text-slate-900">{user.role}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Organizacao</dt>
            <dd className="text-slate-900 truncate">{user.organizationName}</dd>
          </div>
        </dl>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-medium text-slate-900 mb-3">Assinatura</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <div>
            <dt className="text-slate-500">Plano</dt>
            <dd className="text-slate-900">{user.planCode ?? "Trial"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Trial termina</dt>
            <dd className="text-slate-900">{trial}</dd>
          </div>
        </dl>
        <p className="text-sm text-slate-400 mt-4">
          Billing Mercado Pago + RevenueCat entram no commit 7/10.
        </p>
      </section>

      <WhatsAppLinkCard />

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-medium text-slate-900 mb-3">Sessao</h2>
        <Button
          variant="outline"
          onClick={() => {
            void signOut();
          }}
        >
          Sair
        </Button>
      </section>
    </div>
  );
}

import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName.split(" ")[0] || "fazendeiro";

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">
        Ola, {firstName}.
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Esse e o seu painel. Por enquanto vazio - os cards de entradas, saidas
        e saldo entram no commit 9.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Entradas (mes)</p>
          <p className="text-lg font-semibold text-farm-green-dark mt-1">
            R$ 0,00
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Saidas (mes)</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">R$ 0,00</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Saldo (mes)</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">R$ 0,00</p>
        </div>
      </div>
    </div>
  );
}

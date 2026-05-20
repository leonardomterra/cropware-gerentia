import { Sprout } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function FarmsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Fazendas</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Cadastro das fazendas vinculadas a sua conta.
        </p>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-3">
        <div className="size-10 rounded-lg bg-farm-cream flex items-center justify-center">
          <Sprout className="size-5 text-farm-green" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {user?.organizationName ?? "-"}
          </p>
          <p className="text-xs text-slate-500">Fazenda inicial</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        CRUD completo de fazendas (area, cidade, cultura) vem no V2.
      </p>
    </div>
  );
}

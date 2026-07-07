import Sprout from "~icons/material-symbols-light/eco-outline";
import { useAuth } from "@/contexts/AuthContext";

export default function FarmsPage() {
  const { user } = useAuth();

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-slate-500">
          Cadastro das fazendas vinculadas a sua conta.
        </p>
      </header>

      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-3">
        <div className="size-10 rounded-lg bg-farm-primary/10 flex items-center justify-center">
          <Sprout className="size-5 text-farm-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {user?.organizationName ?? "-"}
          </p>
          <p className="text-sm text-slate-500">Fazenda inicial</p>
        </div>
      </div>

      <p className="text-sm text-slate-400 mt-4">
        CRUD completo de fazendas (area, cidade, cultura) vem no V2.
      </p>
    </div>
  );
}

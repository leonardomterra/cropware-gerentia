import { useState, type FormEvent } from "react";
import Loader2 from "~icons/svg-spinners/ring-resize";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "./AuthLayout";

interface AuthScreenProps {
  onGoToSignUp: () => void;
  onGoToForgotPassword: () => void;
}

/**
 * Tela de login. Form enxuto portado do nxsagr (email + senha + Entrar +
 * "Esqueci minha senha"), dentro do AuthLayout split-screen. Mantem o
 * "Criar Conta" (signup publico do gerentia, que o nxsagr nao tem). Sem
 * titulo proprio: no login a marca no painel esquerdo ja contextualiza.
 */
export function AuthScreen({
  onGoToSignUp,
  onGoToForgotPassword,
}: AuthScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || !email || !password;

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signin-email">E-mail</Label>
          <Input
            id="signin-email"
            type="email"
            placeholder="seu@e-mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signin-password">Senha</Label>
          <Input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
            autoComplete="current-password"
          />
        </div>

        {error ? (
          <div
            className="text-sm text-red-600 bg-red-50 p-3 rounded-md"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            className="w-full h-10 rounded-lg font-medium text-white bg-zinc-800 hover:bg-zinc-900 transition-colors inline-flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontSize: "14px" }}
            disabled={disabled}
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center">
                <Loader2 className="size-4 mr-2" />
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>

          <button
            type="button"
            onClick={onGoToSignUp}
            disabled={submitting}
            className="w-full h-10 rounded-lg font-medium border-[1.5px] border-zinc-400 text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontSize: "14px" }}
          >
            Criar Conta
          </button>
        </div>

        <button
          type="button"
          onClick={onGoToForgotPassword}
          disabled={submitting}
          className="w-full text-center text-zinc-500 hover:text-zinc-700"
          style={{ fontSize: "13px" }}
        >
          Esqueci minha senha
        </button>
      </form>
    </AuthLayout>
  );
}

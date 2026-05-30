import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "./AuthLayout";

interface AuthScreenProps {
  onGoToSignUp: () => void;
  onGoToForgotPassword: () => void;
}

/**
 * Tela de login. Estrutura espelhada do CDM (titulo + descricao no card,
 * checkbox Lembrar-me alinhado com "Esqueceu sua senha?", botao primario
 * com gradient + box-shadow + outline secundario "Criar Conta"). Paleta
 * green do CDM trocada por slate da brand Farm.
 */
export function AuthScreen({
  onGoToSignUp,
  onGoToForgotPassword,
}: AuthScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
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

  return (
    <AuthLayout
      title="Acesse sua conta"
      subtitle="Insira suas credenciais para continuar"
    >
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <label
              htmlFor="remember-me"
              className="text-slate-500 cursor-pointer select-none"
              style={{ fontSize: "13px" }}
            >
              Lembrar-me
            </label>
          </div>
          <button
            type="button"
            onClick={onGoToForgotPassword}
            className="text-farm-primary hover:text-farm-primary-dark hover:underline"
            style={{ fontSize: "13px" }}
            disabled={submitting}
          >
            Esqueceu sua senha?
          </button>
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
            className="w-full font-medium text-white rounded-lg transition-all duration-300"
            disabled={submitting || !email || !password}
            style={{
              padding: "13px 0",
              fontSize: "15px",
              background:
                "linear-gradient(135deg, #64748b 0%, #475569 100%)",
              boxShadow: "0 2px 8px rgba(71, 85, 105, 0.3)",
              opacity: submitting || !email || !password ? 0.6 : 1,
              cursor:
                submitting || !email || !password ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!submitting && email && password) {
                e.currentTarget.style.boxShadow =
                  "0 4px 16px rgba(71, 85, 105, 0.45)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(71, 85, 105, 0.3)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center">
                <Loader2 className="size-4 mr-2 animate-spin" />
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>
          <button
            type="button"
            className="w-full font-medium rounded-lg transition-all duration-300"
            disabled={submitting}
            onClick={onGoToSignUp}
            style={{
              padding: "10px 0",
              fontSize: "14px",
              background: "transparent",
              border: "1.5px solid #64748b",
              color: "#475569",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = "rgba(100, 116, 139, 0.08)";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 2px 8px rgba(100, 116, 139, 0.15)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Criar Conta
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

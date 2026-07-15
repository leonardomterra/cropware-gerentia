import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "./AuthLayout";

/**
 * Tela que aparece quando o user clica no link de "esqueci minha senha"
 * recebido por e-mail. Supabase redireciona com #access_token=...&type=recovery,
 * o AuthContext detecta isso e renderiza esta tela.
 */
export function ResetPasswordScreen() {
  const { updatePassword, completePasswordReset, resetError } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (resetError) {
    return (
      <AuthLayout title="Link Inválido" subtitle={resetError}>
        <Button
          type="button"
          variant="default"
          onClick={completePasswordReset}
          className="w-full"
        >
          Voltar para o Login
        </Button>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas nao batem.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao trocar senha.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        title="Senha Atualizada"
        subtitle="Pronto. Você já pode entrar com a nova senha."
      >
        <Button
          type="button"
          variant="default"
          onClick={completePasswordReset}
          className="w-full"
        >
          Ir para a Tela de Login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nova Senha"
      subtitle="Defina uma senha nova pra sua conta."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 6 caracteres"
            autoComplete="new-password"
            required
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="confirm">Confirme a senha</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            disabled={submitting}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="default"
          disabled={submitting || !password || !confirm}
          className="mt-2"
        >
          {submitting ? "Salvando..." : "Salvar Nova Senha"}
        </Button>
      </form>
    </AuthLayout>
  );
}

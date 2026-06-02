import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "./AuthLayout";

interface ForgotPasswordScreenProps {
  onGoToLogin: () => void;
}

export function ForgotPasswordScreen({
  onGoToLogin,
}: ForgotPasswordScreenProps) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar link.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title="Link Enviado"
        subtitle={`Enviamos instruções pra ${email}. Olha também a caixa de spam.`}
      >
        <Button
          type="button"
          variant="default"
          onClick={onGoToLogin}
          className="w-full"
        >
          Voltar para o Login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Esqueci Minha Senha"
      subtitle="Digite seu e-mail e te mandamos um link pra redefinir."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
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
          disabled={submitting || !email}
          className="mt-2"
        >
          {submitting ? "Enviando..." : "Enviar Link"}
        </Button>

        <button
          type="button"
          onClick={onGoToLogin}
          className="text-sm text-farm-primary hover:text-farm-primary-dark underline-offset-2 hover:underline mt-2"
          disabled={submitting}
        >
          Voltar para o Login
        </button>
      </form>
    </AuthLayout>
  );
}

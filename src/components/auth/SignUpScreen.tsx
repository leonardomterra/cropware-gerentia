import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "./AuthLayout";

interface SignUpScreenProps {
  onGoToLogin: () => void;
}

export function SignUpScreen({ onGoToLogin }: SignUpScreenProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | {
    needsConfirmation: boolean;
  }>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (password.length < 6) {
      setError("A senha precisa ter ao menos 6 caracteres.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        // App individual: org nomeada com o proprio nome do usuario (sem
        // pedir "nome da conta" no cadastro). Reintroduzir um campo proprio
        // quando existir o app multi-usuario (fazendas/empresas).
        farmName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        title="Conta Criada"
        subtitle={
          success.needsConfirmation
            ? `Confirme seu e-mail (${email}) pra entrar. Olha também a caixa de spam.`
            : "Tudo pronto. Você já pode entrar."
        }
      >
        <Button
          type="button"
          variant="default"
          onClick={onGoToLogin}
          className="w-full"
        >
          Ir para o Login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar Conta"
      subtitle="14 dias grátis. Sem cartão agora."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="fullName">Seu nome</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
            disabled={submitting}
          />
        </div>

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

        <div className="flex flex-col gap-1">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Minimo 6 caracteres"
            required
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="phone">
            Telefone <span className="text-slate-400 font-normal">(opcional)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
            inputMode="tel"
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
          disabled={submitting || !email || !password || !fullName}
          className="mt-2"
        >
          {submitting ? "Criando..." : "Criar Conta"}
        </Button>

        <button
          type="button"
          onClick={onGoToLogin}
          className="text-sm text-farm-primary hover:text-farm-primary-dark underline-offset-2 hover:underline mt-2"
          disabled={submitting}
        >
          Já Tenho Conta — Entrar
        </button>
      </form>
    </AuthLayout>
  );
}

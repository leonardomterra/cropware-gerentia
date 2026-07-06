import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "./AuthLayout";

interface SignUpScreenProps {
  onGoToLogin: () => void;
}

const MIN_PASSWORD = 8;

/** Pontua a senha de 0 a 4 (tamanho + variedade de caracteres). */
function scorePassword(pw: string): number {
  let score = 0;
  if (pw.length >= MIN_PASSWORD) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export function SignUpScreen({ onGoToLogin }: SignUpScreenProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<null | {
    needsConfirmation: boolean;
  }>(null);

  const strength = useMemo(
    () => (password ? scorePassword(password) : 0),
    [password],
  );
  const strengthColor =
    strength <= 1 ? "bg-red-500" : strength === 2 ? "bg-amber-500" : "bg-emerald-500";
  const strengthLabel =
    strength <= 1 ? "Fraca" : strength === 2 ? "Média" : "Forte";
  const strengthText =
    strength <= 1 ? "text-red-600" : strength === 2 ? "text-amber-600" : "text-emerald-600";

  // Dica dinâmica: aponta o próximo passo pra fortalecer a senha.
  const passwordHint = useMemo(() => {
    if (!password) return "";
    if (password.length < MIN_PASSWORD)
      return `Use pelo menos ${MIN_PASSWORD} caracteres.`;
    if (!(/[a-z]/.test(password) && /[A-Z]/.test(password)))
      return "Misture letras maiúsculas e minúsculas.";
    if (!/\d/.test(password)) return "Inclua ao menos um número.";
    if (!/[^A-Za-z0-9]/.test(password))
      return "Inclua um símbolo, como ! @ # $.";
    return "Senha forte — está ótima.";
  }, [password]);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
      setSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
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
    <AuthLayout title="Criar Conta" subtitle="14 dias grátis. Sem cartão agora.">
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
            placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
            required
            disabled={submitting}
          />
          {password ? (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i < strength ? strengthColor : "bg-slate-200",
                    )}
                  />
                ))}
              </div>
              <p className={cn("text-sm font-medium mt-2", strengthText)}>
                Força da senha: {strengthLabel}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">{passwordHint}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            disabled={submitting}
          />
          {confirmPassword && !passwordsMatch ? (
            <p className="text-xs text-red-600 mt-0.5">As senhas não coincidem.</p>
          ) : null}
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
          disabled={
            submitting ||
            !email ||
            !fullName ||
            password.length < MIN_PASSWORD ||
            !passwordsMatch
          }
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

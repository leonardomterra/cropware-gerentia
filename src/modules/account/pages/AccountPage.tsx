import { useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import Person from "~icons/material-symbols-light/person-outline";
import Lock from "~icons/material-symbols-light/lock-outline";
import Premium from "~icons/material-symbols-light/workspace-premium-outline";
import Shield from "~icons/material-symbols-light/verified-user-outline";
import Warning from "~icons/material-symbols-light/warning-outline";
import { useAuth, type FarmRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { cn } from "@/components/ui/utils";
import { WhatsAppLinkCard } from "../components/WhatsAppLinkCard";

const ROLE_LABEL: Record<FarmRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

function formatPhoneBR(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Card de seção com cabeçalho (chip de ícone + título + descrição). */
function Section({
  icon: Icon,
  title,
  description,
  action,
  tone = "default",
  className,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-white rounded-lg border p-5",
        tone === "danger" ? "border-red-200" : "border-slate-200",
        className,
      )}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className={cn(
            "mt-0.5 flex size-8 items-center justify-center rounded-md shrink-0",
            tone === "danger"
              ? "bg-red-50 text-red-600"
              : "bg-slate-100 text-slate-600",
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-slate-900">{title}</h2>
          {description ? (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Campo só-leitura (label em cima, valor embaixo). */
function ReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="text-sm text-slate-900 mt-1">{children}</div>
    </div>
  );
}

export default function AccountPage() {
  const { user, updateProfile, updateEmail, updatePassword } = useAuth();

  // Perfil
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // E-mail
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Senha
  const [editingPassword, setEditingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Excluir conta
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!user) return null;

  const profileDirty = fullName.trim() !== user.fullName || phone !== user.phone;

  const trial = user.trialEndsAt
    ? new Date(user.trialEndsAt).toLocaleDateString("pt-BR")
    : "—";

  async function handleSaveProfile() {
    if (!profileDirty) return;
    setSavingProfile(true);
    try {
      await updateProfile({ fullName, phone });
      toast.success("Perfil atualizado.");
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveEmail() {
    const email = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSavingEmail(true);
    try {
      await updateEmail(email);
      toast.success(
        `Enviamos um link de confirmação para ${email}. O e-mail muda após você confirmar.`,
      );
      setEditingEmail(false);
      setNewEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o e-mail.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSavePassword() {
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(password);
      toast.success("Senha alterada.");
      setEditingPassword(false);
      setPassword("");
      setPassword2("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-base font-medium text-slate-900">Conta</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gerencie seu perfil, acesso, assinatura e integrações.
        </p>
      </header>

      {/* 2x2: Perfil | Assinatura (linha 1), Acesso e seguranca | WhatsApp
          (linha 2). O grid estica cada LINHA, entao os dois cards da mesma
          linha ficam com a mesma altura (align-items: stretch default). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            icon={Person}
            title="Perfil"
            description="Seus dados pessoais."
            action={
              <Button
                size="sm"
                onClick={handleSaveProfile}
                disabled={!profileDirty || savingProfile}
              >
                {savingProfile ? "Salvando..." : "Salvar"}
              </Button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="acc-name" className="text-xs text-slate-500">
                  Nome
                </Label>
                <Input
                  id="acc-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-phone" className="text-xs text-slate-500">
                  Telefone
                </Label>
                <Input
                  id="acc-phone"
                  value={formatPhoneBR(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                />
              </div>
              <ReadOnlyField label="Função">
                <Badge>{ROLE_LABEL[user.role]}</Badge>
              </ReadOnlyField>
              <ReadOnlyField label="Organização">
                <span className="truncate block">{user.organizationName}</span>
              </ReadOnlyField>
            </div>
          </Section>

          <Section
            icon={Premium}
            title="Assinatura"
            description="Seu plano atual."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ReadOnlyField label="Plano">{user.planCode ?? "Trial"}</ReadOnlyField>
              <ReadOnlyField label="Trial termina">{trial}</ReadOnlyField>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Cobrança (Mercado Pago + RevenueCat) entra em um commit futuro.
            </p>
          </Section>

          <Section
            icon={Lock}
            title="Acesso e Segurança"
            description="E-mail, senha e verificação."
          >
            <div className="divide-y divide-slate-100">
              {/* E-mail */}
              <div className="pb-4">
                {!editingEmail ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">E-mail</p>
                      <p className="text-sm text-slate-900 truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingEmail(true)}
                    >
                      Alterar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="acc-email" className="text-xs text-slate-500">
                      Novo e-mail
                    </Label>
                    <Input
                      id="acc-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="novo@email.com"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleSaveEmail}
                        disabled={savingEmail}
                      >
                        {savingEmail ? "Enviando..." : "Enviar Confirmação"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingEmail(false);
                          setNewEmail("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Senha */}
              <div className="py-4">
                {!editingPassword ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Senha</p>
                      <p className="text-sm text-slate-900 mt-0.5">••••••••</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPassword(true)}
                    >
                      Alterar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="acc-pwd" className="text-xs text-slate-500">
                          Nova senha
                        </Label>
                        <Input
                          id="acc-pwd"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="ao menos 6 caracteres"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="acc-pwd2" className="text-xs text-slate-500">
                          Confirmar senha
                        </Label>
                        <Input
                          id="acc-pwd2"
                          type="password"
                          value={password2}
                          onChange={(e) => setPassword2(e.target.value)}
                          placeholder="repita a senha"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleSavePassword}
                        disabled={savingPassword}
                      >
                        {savingPassword ? "Salvando..." : "Salvar Senha"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPassword(false);
                          setPassword("");
                          setPassword2("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2FA (visual por enquanto) */}
              <div className="pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Shield className="size-5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-900">
                          Verificação em Duas Etapas
                        </p>
                        <Badge>Em breve</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Camada extra de segurança no login com um código no celular.
                      </p>
                    </div>
                  </div>
                  <Switch disabled aria-label="Verificação em duas etapas" />
                </div>
              </div>
            </div>
          </Section>

          <WhatsAppLinkCard />
      </div>

      {/* Zona de perigo (full width) */}
      <Section
        icon={Warning}
        title="Zona de Perigo"
        description="Ações irreversíveis."
        tone="danger"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-900">Excluir Conta</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Remove sua conta e os dados associados. Não dá pra desfazer.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 self-start sm:self-auto"
          >
            Excluir Conta
          </Button>
        </div>
      </Section>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir Conta"
        description="Esta ação é permanente e remove sua conta e os dados associados. Tem certeza?"
        confirmLabel="Excluir Minha Conta"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setDeleteOpen(false);
          toast.info("Exclusão de conta estará disponível em breve.");
        }}
      />
    </div>
  );
}

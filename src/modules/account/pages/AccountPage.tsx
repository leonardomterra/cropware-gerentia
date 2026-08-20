import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import Person from "~icons/ph/user";
import Lock from "~icons/ph/lock";
import Warning from "~icons/ph/warning";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { cn } from "@/components/ui/utils";
import ArrowLeft from "~icons/ph/arrow-left";
// Mesmo disquete do Salvar de PaginaDeFormulario — um só ícone para "salvar"
// em todo o app.
import Save from "~icons/ph/floppy-disk";
import SealCheck from "~icons/ph/seal-check";
import UserDuotone from "~icons/ph/user-duotone";
import CreditCardDuotone from "~icons/ph/credit-card-duotone";
import LockDuotone from "~icons/ph/lock-duotone";
import WhatsappDuotone from "~icons/ph/whatsapp-logo-duotone";
import WarningDuotone from "~icons/ph/warning-duotone";
import { BOTAO_BARRA, BOTAO_BARRA_PRIMARIO } from "@/lib/ui-tokens";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MIN_SENHA,
  corDaForca,
  corDoTextoDaForca,
  dicaDeSenha,
  forcaDaSenha,
  rotuloDaForca,
  senhaAceita,
} from "@/utils/senha";
import { supabase } from "@/utils/supabase/client";
import { WhatsAppLinkCard } from "../components/WhatsAppLinkCard";
import { SubscriptionCard } from "../components/SubscriptionCard";

// "Função"/"Organização" ocultas no app individual (sem conceito de equipe).
// Reativar junto com a aba Equipe quando existir o app multi-usuario.
// const ROLE_LABEL: Record<FarmRole, string> = {
//   owner: "Proprietário",
//   admin: "Administrador",
//   member: "Membro",
// };

function formatPhoneBR(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Áreas de atuação. Lista fechada, e não campo livre: "profissão" digitada à
 * mão vira mil grafias para a mesma coisa ("produtor", "agricultor",
 * "fazendeiro") e não serve para agrupar nada depois.
 *
 * O banco guarda o SLUG; o rótulo pode mudar sem migração de dado.
 */
const AREAS_DE_ATUACAO: { valor: string; rotulo: string }[] = [
  { valor: "produtor_rural", rotulo: "Produtor Rural" },
  { valor: "autonomo", rotulo: "Autônomo" },
  { valor: "empresario", rotulo: "Empresário" },
  { valor: "profissional_liberal", rotulo: "Profissional Liberal" },
  { valor: "servidor_publico", rotulo: "Servidor Público" },
  { valor: "assalariado", rotulo: "Assalariado (CLT)" },
  { valor: "aposentado", rotulo: "Aposentado" },
  { valor: "estudante", rotulo: "Estudante" },
  { valor: "outro", rotulo: "Outro" },
];

/** "12345678901" -> "123.456.789-01". Formata enquanto digita. */
function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Card de seção com cabeçalho (chip de ícone + título + descrição). */
function Section({
  icon: Icon,
  title,
  description,
  action,
  tone = "default",
  className,
  semCabecalho = false,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
  /** Esconde ícone/título/descrição: dentro de uma sub-página da Conta, o
   *  cabeçalho ao lado do Voltar já diz de que assunto se trata, e repetir
   *  punha o mesmo título duas vezes na mesma tela. */
  semCabecalho?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border p-5",
        // Fundo tingido no tom de perigo, não só a borda: uma borda fina de
        // 1px é o mesmo peso visual de qualquer outro card, e esta é a única
        // tela do app que apaga a conta.
        tone === "danger"
          ? "bg-red-50 border-red-200"
          : "bg-white border-slate-200",
        className,
      )}
    >
      {!semCabecalho && (
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
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

type SecaoDaConta =
  | "perfil"
  | "assinatura"
  | "seguranca"
  | "whatsapp"
  | "perigo";

/**
 * Os atalhos da tela de Conta.
 *
 * Ícones duotone coloridos, como no trilho — cada assunto tem a própria cor,
 * então o olho encontra "Assinatura" pela cor antes de ler o rótulo.
 *
 * "Zona de Perigo" fica por último E em vermelho: é a única entrada daqui que
 * faz algo irreversível, e a cor precisa dizer isso antes do clique.
 */
const ATALHOS: {
  id: SecaoDaConta;
  Icon: typeof UserDuotone;
  cor: string;
  titulo: string;
  descricao: string;
}[] = [
  {
    id: "perfil",
    Icon: UserDuotone,
    cor: "text-blue-500",
    titulo: "Perfil",
    descricao: "Seu nome e telefone",
  },
  {
    id: "assinatura",
    Icon: CreditCardDuotone,
    cor: "text-violet-500",
    titulo: "Assinatura",
    descricao: "Plano, cobrança e pagamento",
  },
  {
    id: "seguranca",
    Icon: LockDuotone,
    cor: "text-teal-500",
    titulo: "Acesso e Segurança",
    descricao: "E-mail, senha e verificação",
  },
  {
    id: "whatsapp",
    Icon: WhatsappDuotone,
    cor: "text-emerald-500",
    titulo: "WhatsApp",
    descricao: "Número vinculado ao seu acesso",
  },
  {
    id: "perigo",
    Icon: WarningDuotone,
    cor: "text-red-500",
    // Título = o que a entrada FAZ; subtítulo = o aviso. Ao contrário,
    // "Zona de Perigo" obrigava a ler a segunda linha para descobrir do que se
    // tratava — e num índice a primeira linha é a que se lê.
    titulo: "Excluir a Conta",
    descricao: "Zona de perigo",
  },
];

export default function AccountPage() {
  const { user, updateProfile, updateEmail, updatePassword } = useAuth();

  // Perfil
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  // CPF/cidade/estado já existiam em `users_meta` e nunca tinham chegado à
  // interface. Vêm direto da tabela, e não do /auth/me: aquele endpoint devolve
  // só nome, telefone e o vínculo do WhatsApp, e ampliá-lo exigiria mexer na
  // edge function para um dado que só esta tela usa.
  const [cpf, setCpf] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [area, setArea] = useState("");
  // Verificação do e-mail: vem do Supabase Auth (`email_confirmed_at`), não da
  // nossa `users_meta` — quem manda no estado da credencial é o Auth. null =
  // ainda consultando, para a tela não afirmar "não verificado" antes de saber.
  const [emailVerificado, setEmailVerificado] = useState<boolean | null>(null);
  const [reenviando, setReenviando] = useState(false);

  const [extrasCarregados, setExtrasCarregados] = useState<{
    cpf: string;
    city: string;
    uf: string;
    area: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    void (async () => {
      const { data } = await supabase
        .from("users_meta")
        .select("cpf, city, state, activity_area")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelado || !data) return;
      const carregado = {
        cpf: data.cpf ?? "",
        city: data.city ?? "",
        uf: data.state ?? "",
        area: data.activity_area ?? "",
      };
      setCpf(carregado.cpf);
      setCity(carregado.city);
      setUf(carregado.uf);
      setArea(carregado.area);
      setExtrasCarregados(carregado);
    })();
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelado) {
        setEmailVerificado(!!data.user?.email_confirmed_at);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user]);
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
  // null = hub de atalhos; qualquer outro valor = a tela daquele assunto.
  const [secao, setSecao] = useState<SecaoDaConta | null>(null);

  if (!user) return null;

  const profileDirty =
    fullName.trim() !== user.fullName ||
    phone !== user.phone ||
    // `extrasCarregados` só existe depois da consulta: sem essa guarda, os
    // campos vazios do primeiro render contariam como alteração e o Salvar
    // nasceria habilitado, pronto para apagar o que está no banco.
    (extrasCarregados !== null &&
      (cpf !== extrasCarregados.cpf ||
        city !== extrasCarregados.city ||
        uf !== extrasCarregados.uf ||
        area !== extrasCarregados.area));

  async function handleSaveProfile() {
    if (!profileDirty) return;
    setSavingProfile(true);
    try {
      await updateProfile({
        fullName,
        phone,
        cpf,
        city,
        state: uf,
        activityArea: area,
      });
      setExtrasCarregados({ cpf, city, uf, area });
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
      toast.error(
        e instanceof Error ? e.message : "Não foi possível alterar o e-mail.",
      );
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleReenviarConfirmacao() {
    if (!user) return;
    setReenviando(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });
      if (error) throw new Error(error.message);
      toast.success("Enviamos um novo link de confirmação para o seu e-mail.");
    } catch {
      toast.error("Não foi possível reenviar agora. Tente daqui a pouco.");
    } finally {
      setReenviando(false);
    }
  }

  async function handleSavePassword() {
    // Mesma régua do cadastro (utils/senha): aceitar aqui uma senha que o
    // cadastro recusa seria uma porta dos fundos para a conta.
    if (!senhaAceita(password)) {
      toast.error(dicaDeSenha(password) || "Escolha uma senha mais forte.");
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
      toast.error(
        e instanceof Error ? e.message : "Não foi possível alterar a senha.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  // HUB DE ATALHOS. A página empilhava todas as seções numa coluna só, e isso
  // dava o mesmo peso a "Perfil" e a "Excluir Conta" — a ação mais perigosa
  // ficava à mesma distância da mais banal. Com atalhos, cada assunto ganha a
  // própria tela e a inicial vira um índice do que dá para fazer aqui.
  if (!secao) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ATALHOS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSecao(a.id)}
            className="text-left bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300"
          >
            <a.Icon className={cn("size-7 shrink-0", a.cor)} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">
                {a.titulo}
              </span>
              <span className="block text-sm text-slate-500">
                {a.descricao}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  const atalho = ATALHOS.find((a) => a.id === secao)!;

  return (
    <div className="space-y-4">
      {/* Voltar no mesmo molde de PaginaDeAnexo: cinza sem borda, com o assunto
          ao lado como contexto. */}
      <div className="flex flex-wrap items-center gap-3 w-full">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSecao(null)}
          className={cn(BOTAO_BARRA, "rounded-md")}
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar
        </Button>

        {/* Salvar do Perfil vive AQUI, e não dentro do card: o card perdeu o
            próprio cabeçalho (era o mesmo título duas vezes na tela), e ação
            perdida no meio do conteúdo não se acha. */}
        {secao === "perfil" && (
          <Button
            onClick={handleSaveProfile}
            disabled={!profileDirty || savingProfile}
            className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto")}
          >
            <Save className="size-4 mr-2" />
            {savingProfile ? "Salvando..." : "Salvar"}
          </Button>
        )}

        {/* Caixa com borda, na altura dos botões — mas em <span>, não em
            <button disabled>: é o nome do assunto, não uma ação apagada.

            Encostado à DIREITA (`ml-auto`): à esquerda ficam as ações — sair e
            salvar —, e o assunto é rótulo, não coisa para clicar. Separá-los
            impede que o olho leia os três como uma fileira de botões. */}
        <span className="h-9 px-3 ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 min-w-0">
          <atalho.Icon className={cn("size-[18px] shrink-0", atalho.cor)} />
          <span className="truncate">{atalho.titulo}</span>
        </span>
      </div>

      {secao === "perfil" && (
        <Section icon={Person} title="Perfil" semCabecalho>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name" className="text-sm text-slate-500">
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
              <Label htmlFor="acc-phone" className="text-sm text-slate-500">
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
            {/* Só o nome é obrigatório, e é o único com `*`. O resto fica sem
                marca nenhuma: repetir "(opcional)" em cada rótulo era mais
                texto do que informação. */}
            <div className="space-y-1.5">
              <Label htmlFor="acc-cpf" className="text-sm text-slate-500">
                CPF
              </Label>
              <Input
                id="acc-cpf"
                value={formatCpf(cpf)}
                onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-city" className="text-sm text-slate-500">
                Cidade
              </Label>
              <Input
                id="acc-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Uberaba"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-slate-500">Área de Atuação</Label>
              <Select
                value={area || "nenhuma"}
                onValueChange={(v) => setArea(v === "nenhuma" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* "Não informar" precisa ser uma OPÇÃO: sem ela, quem
                      escolhe uma área por engano não tem como voltar ao vazio —
                      select não desmarca. */}
                  <SelectItem value="nenhuma">Não informar</SelectItem>
                  {AREAS_DE_ATUACAO.map((a) => (
                    <SelectItem key={a.valor} value={a.valor}>
                      {a.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-uf" className="text-sm text-slate-500">
                Estado
              </Label>
              <Input
                id="acc-uf"
                value={uf}
                onChange={(e) =>
                  setUf(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
                }
                placeholder="MG"
                maxLength={2}
              />
            </div>
            {/* Funcao/Organizacao ocultas: app individual (sem equipe).
              <ReadOnlyField label="Função">
                <Badge>{ROLE_LABEL[user.role]}</Badge>
              </ReadOnlyField>
              <ReadOnlyField label="Organização">
                <span className="truncate block">{user.organizationName}</span>
              </ReadOnlyField> */}
          </div>
        </Section>
      )}

      {secao === "assinatura" && <SubscriptionCard />}

      {secao === "seguranca" && (
        <Section icon={Lock} title="Acesso e Segurança" semCabecalho>
          <div className="divide-y divide-slate-100">
            {/* E-mail */}
            <div className="pb-4">
              {!editingEmail ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500">E-mail</p>
                    <p className="text-sm text-slate-900 truncate mt-0.5">
                      {user.email}
                    </p>
                    {/* O selo só aparece DEPOIS da consulta (null = ainda
                        buscando). Mostrar "não verificado" enquanto não se sabe
                        seria acusar a conta de um problema que talvez não
                        exista — e o susto é pior que a espera de meio segundo. */}
                    {emailVerificado !== null && (
                      <Badge
                        colorScheme={emailVerificado ? "emerald" : "amber"}
                        className="mt-2"
                      >
                        {emailVerificado ? <SealCheck /> : <WarningDuotone />}
                        {emailVerificado ? "Verificado" : "Não verificado"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {emailVerificado === false && (
                      <Button
                        variant="ghost"
                        onClick={handleReenviarConfirmacao}
                        disabled={reenviando}
                        className={cn(BOTAO_BARRA, "rounded-md")}
                      >
                        {reenviando ? "Enviando..." : "Reenviar Confirmação"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setEditingEmail(true)}
                      className={cn(BOTAO_BARRA, "rounded-md")}
                    >
                      Alterar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="acc-email" className="text-sm text-slate-500">
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
                      className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto")}
                      onClick={handleSaveEmail}
                      disabled={savingEmail}
                    >
                      {savingEmail ? "Enviando..." : "Enviar Confirmação"}
                    </Button>
                    <Button
                      variant="ghost"
                      className={cn(BOTAO_BARRA, "rounded-md")}
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
            <div className="pt-4">
              {!editingPassword ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500">Senha</p>
                    <p className="text-sm text-slate-900 mt-0.5">••••••••</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setEditingPassword(true)}
                    className={cn(
                      BOTAO_BARRA,
                      "rounded-md self-start sm:self-auto",
                    )}
                  >
                    Alterar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="acc-pwd"
                        className="text-sm text-slate-500"
                      >
                        Nova senha
                      </Label>
                      <Input
                        id="acc-pwd"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={`ao menos ${MIN_SENHA} caracteres`}
                      />
                      {/* Medidor idêntico ao do cadastro. Mostrar a força
                          ENQUANTO digita, e não só ao salvar, é o que evita a
                          pessoa escrever a senha inteira para levar um erro. */}
                      {password ? (
                        <div className="pt-1">
                          <div className="flex gap-1">
                            {[0, 1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-1.5 flex-1 rounded-full transition-colors",
                                  i < forcaDaSenha(password)
                                    ? corDaForca(forcaDaSenha(password))
                                    : "bg-slate-200",
                                )}
                              />
                            ))}
                          </div>
                          <p
                            className={cn(
                              "text-sm font-medium mt-2",
                              corDoTextoDaForca(forcaDaSenha(password)),
                            )}
                          >
                            Força da senha:{" "}
                            {rotuloDaForca(forcaDaSenha(password))}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {dicaDeSenha(password)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="acc-pwd2"
                        className="text-sm text-slate-500"
                      >
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
                      className={cn(BOTAO_BARRA_PRIMARIO, "gap-1.5 w-auto")}
                      onClick={handleSavePassword}
                      disabled={
                        savingPassword ||
                        !senhaAceita(password) ||
                        password !== password2
                      }
                    >
                      {savingPassword ? "Salvando..." : "Salvar Senha"}
                    </Button>
                    <Button
                      variant="ghost"
                      className={cn(BOTAO_BARRA, "rounded-md")}
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
          </div>
        </Section>
      )}

      {secao === "whatsapp" && <WhatsAppLinkCard />}

      {secao === "perigo" && (
        <Section
          icon={Warning}
          title="Excluir a Conta"
          tone="danger"
          semCabecalho
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-900">
                Ação Irreversível
              </p>
              {/* slate-600, e não o 500 dos demais cards: sobre o fundo red-50
                  o 500 cai para 4,4:1 e reprova no AA. */}
              <p className="text-sm text-slate-600 mt-0.5">
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
      )}

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

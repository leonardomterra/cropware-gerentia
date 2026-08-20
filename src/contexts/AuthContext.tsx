import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/utils/supabase/client";
import {
  clearSessionTokens,
  getSessionTokens,
  persistSessionTokens,
} from "@/utils/sessionStorage";
import { api } from "@/utils/api";
import { isMasterUser } from "@/utils/masterUsers";
import { appRedirectBase } from "@/utils/platform";
import { invalidateOrgPeople } from "@/modules/team/hooks/useOrgPeople";

/**
 * Perfis de acesso — ver docs/ORGANIZACOES-E-PERFIS.md.
 *   owner/admin (Gestor)  veem a organizacao inteira, editam so o proprio
 *   member      (Usuario) ve e edita so o proprio
 *   viewer      (Convidado) ve a organizacao inteira, nao edita nada
 */
export type FarmRole = "owner" | "admin" | "member" | "viewer";

/** Rotulo do perfil na interface. */
export const ROLE_LABELS: Record<FarmRole, string> = {
  owner: "Gestor (titular)",
  admin: "Gestor",
  member: "Usuário",
  viewer: "Convidado",
};

export interface FarmPermissions {
  /** Enxerga os lancamentos de toda a organizacao. */
  canReadAll: boolean;
  /** Pode criar/editar/apagar (o proprio). */
  canWrite: boolean;
  /** Pode editar lancamento de terceiro (hoje: ninguem). */
  canWriteOthers: boolean;
  /** Pode convidar/remover gente e mexer em centro de custo. */
  canManageTeam: boolean;
}

export interface CostCenter {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
}

export interface FarmUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: FarmRole;
  organizationId: string;
  organizationName: string;
  trialEndsAt: string | null;
  planCode: string | null;
  whatsappLinked: boolean;
  allowedCostCenterIds: "all" | string[];
  costCenters: CostCenter[];
  /** individual = assinante avulso; company = organizacao com equipe. */
  organizationKind: "individual" | "company";
  seatsLimit: number | null;
  seatsUsed: number | null;
  permissions: FarmPermissions;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  farmName: string;
  phone?: string;
  cpf?: string;
}

interface AuthMeResponse {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    whatsapp_linked: boolean;
  };
  role: FarmRole;
  organization: {
    id: string;
    name: string;
    kind?: "individual" | "company";
    seats_limit?: number | null;
    seats_used?: number | null;
    trial_started_at: string | null;
    trial_ends_at: string | null;
  } | null;
  permissions?: {
    can_read_all: boolean;
    can_write: boolean;
    can_write_others: boolean;
    can_manage_team: boolean;
  };
  allowed_cost_center_ids: "all" | string[];
  cost_centers: CostCenter[];
}

interface AuthContextType {
  user: FarmUser | null;
  loading: boolean;
  isResettingPassword: boolean;
  resetError: string | null;
  isAdmin: boolean;
  isMaster: boolean;
  /** Convidado: so leitura. Atalho pra esconder acao em vez de deixar dar erro. */
  isViewer: boolean;
  canWrite: boolean;
  canReadAll: boolean;
  /** Organizacao com equipe (kind=company). Assinante avulso nao ve nada de time. */
  isTeamOrg: boolean;
  canAccessCC: (ccId: string) => boolean;
  refreshUser: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (fields: {
    fullName?: string;
    phone?: string | null;
    cpf?: string | null;
    city?: string | null;
    state?: string | null;
    activityArea?: string | null;
  }) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  completePasswordReset: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(): Promise<FarmUser | null> {
  try {
    const me = await api<AuthMeResponse>("/auth/me", { method: "GET" });
    if (!me.organization) {
      console.warn("[fetchUserProfile] user has no organization linked");
      return null;
    }
    return {
      id: me.user.id,
      email: me.user.email,
      fullName: me.user.full_name ?? "",
      phone: me.user.phone ?? "",
      role: me.role,
      organizationId: me.organization.id,
      organizationName: me.organization.name,
      trialEndsAt: me.organization.trial_ends_at ?? null,
      planCode: null,
      whatsappLinked: me.user.whatsapp_linked,
      allowedCostCenterIds: me.allowed_cost_center_ids,
      costCenters: me.cost_centers ?? [],
      organizationKind: me.organization.kind ?? "individual",
      seatsLimit: me.organization.seats_limit ?? null,
      seatsUsed: me.organization.seats_used ?? null,
      // Fallback pro caso da API estar numa versao anterior: deriva do role em
      // vez de deixar a UI sem permissao nenhuma.
      permissions: me.permissions
        ? {
            canReadAll: me.permissions.can_read_all,
            canWrite: me.permissions.can_write,
            canWriteOthers: me.permissions.can_write_others,
            canManageTeam: me.permissions.can_manage_team,
          }
        : {
            canReadAll: me.role !== "member",
            canWrite: me.role !== "viewer",
            canWriteOthers: false,
            canManageTeam: me.role === "owner" || me.role === "admin",
          },
    };
  } catch (err) {
    console.warn("[fetchUserProfile] failed:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FarmUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const type = hashParams.get("type");
        const accessTokenFromUrl = hashParams.get("access_token");
        const refreshTokenFromUrl = hashParams.get("refresh_token");
        const errorParam = hashParams.get("error");
        const errorDescription = hashParams.get("error_description");

        if (errorParam) {
          let msg = "Erro ao redefinir senha.";
          if (
            errorParam === "access_denied" ||
            errorDescription?.includes("expired")
          ) {
            msg =
              "O link de recuperacao expirou ou e invalido. Solicite um novo.";
          } else if (errorDescription) {
            msg = decodeURIComponent(errorDescription.replace(/\+/g, " "));
          }
          setResetError(msg);
          window.location.hash = "";
          setLoading(false);
          return;
        }

        // recovery = reset de senha; invite = primeiro acesso (convite por email).
        // Ambos caem na tela de definir senha (setIsResettingPassword).
        if (
          (type === "recovery" || type === "invite") &&
          accessTokenFromUrl &&
          refreshTokenFromUrl
        ) {
          await supabase.auth.setSession({
            access_token: accessTokenFromUrl,
            refresh_token: refreshTokenFromUrl,
          });
          setIsResettingPassword(true);
          window.location.hash = "";
          setLoading(false);
          return;
        }

        const { accessToken, refreshToken } = await getSessionTokens();
        if (!accessToken || !refreshToken) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error || !data.session || !data.user) {
          await clearSessionTokens();
          setLoading(false);
          return;
        }

        // Persiste os tokens JÁ renovados pelo setSession ANTES do /auth/me —
        // senão o api() manda o token antigo (possivelmente expirado) e toma um
        // 401 no console antes do refresh+retry.
        await persistSessionTokens(
          data.session.access_token,
          data.session.refresh_token,
          data.session.expires_at ?? null,
        );

        const profile = await fetchUserProfile();
        if (profile) {
          setUser(profile);
        } else {
          await clearSessionTokens();
        }
      } catch (err) {
        console.error("[AuthContext.init] failure:", err);
        await clearSessionTokens();
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await fetchUserProfile();
    if (profile) setUser(profile);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session || !data.user) {
      throw new Error(translateAuthError(error?.message));
    }

    await persistSessionTokens(
      data.session.access_token,
      data.session.refresh_token,
      data.session.expires_at ?? null,
    );

    const profile = await fetchUserProfile();
    if (!profile) {
      throw new Error(
        "Sua conta esta sem organizacao vinculada. Contate o suporte.",
      );
    }
    setUser(profile);
  }, []);

  const signUp = useCallback(
    async (input: SignUpInput): Promise<{ needsConfirmation: boolean }> => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            farm_signup: true,
            full_name: input.fullName,
            farm_name: input.farmName,
            phone: input.phone?.replace(/\D/g, "") || undefined,
            cpf: input.cpf?.replace(/\D/g, "") || undefined,
          },
          emailRedirectTo: appRedirectBase(),
        },
      });

      if (error) {
        throw new Error(translateAuthError(error.message));
      }

      if (data.user?.identities && data.user.identities.length === 0) {
        throw new Error("Este e-mail ja esta cadastrado.");
      }

      const needsConfirmation = !data.session;
      if (data.session && data.user) {
        await persistSessionTokens(
          data.session.access_token,
          data.session.refresh_token,
          data.session.expires_at ?? null,
        );
        const profile = await fetchUserProfile();
        if (profile) setUser(profile);
      }
      return { needsConfirmation };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await clearSessionTokens();
    // Sair não recarrega a página: o cache de nomes da equipe precisa ir embora
    // na mão, senão fica na memória depois que a pessoa saiu.
    invalidateOrgPeople();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appRedirectBase(),
    });
    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  // Atualiza nome/telefone direto na users_meta (RLS "user updates own meta"
  // permite o proprio row). Depois re-hidrata o FarmUser.
  const updateProfile = useCallback(
    async (fields: {
      fullName?: string;
      phone?: string | null;
      cpf?: string | null;
      city?: string | null;
      state?: string | null;
      activityArea?: string | null;
    }) => {
      if (!user) return;
      const updates: Record<string, unknown> = {};
      // Campo em branco vira NULL, não string vazia: "" e null contariam como
      // valores diferentes em qualquer consulta futura, e ambos significam
      // "não informado".
      const texto = (v: string | null | undefined) =>
        v === undefined ? undefined : v?.trim() || null;
      if (fields.fullName !== undefined)
        updates.full_name = fields.fullName.trim();
      if (fields.phone !== undefined)
        updates.phone = fields.phone ? fields.phone.replace(/\D/g, "") : null;
      if (fields.cpf !== undefined)
        updates.cpf = fields.cpf ? fields.cpf.replace(/\D/g, "") || null : null;
      if (fields.city !== undefined) updates.city = texto(fields.city);
      if (fields.state !== undefined)
        updates.state = texto(fields.state)?.toUpperCase() ?? null;
      if (fields.activityArea !== undefined)
        updates.activity_area = texto(fields.activityArea);
      if (Object.keys(updates).length === 0) return;

      const { error } = await supabase
        .from("users_meta")
        .update(updates)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      await refreshUser();
    },
    [user, refreshUser],
  );

  // Troca de e-mail via Supabase Auth. Dispara confirmacao por e-mail; o
  // endereco so muda de fato apos o usuario confirmar pelo link.
  const updateEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const completePasswordReset = useCallback(() => {
    setIsResettingPassword(false);
    setResetError(null);
    window.location.hash = "";
    window.location.reload();
  }, []);

  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const isMaster = isMasterUser(user?.email);
  const isViewer = user?.role === "viewer";
  const canWrite = user?.permissions.canWrite ?? false;
  const canReadAll = user?.permissions.canReadAll ?? false;
  const isTeamOrg = user?.organizationKind === "company";
  const canAccessCC = useCallback(
    (ccId: string): boolean => {
      if (!user) return false;
      if (user.allowedCostCenterIds === "all") return true;
      return user.allowedCostCenterIds.includes(ccId);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isResettingPassword,
        resetError,
        isAdmin,
        isMaster,
        isViewer,
        canWrite,
        canReadAll,
        isTeamOrg,
        canAccessCC,
        refreshUser,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
        updateProfile,
        updateEmail,
        completePasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function translateAuthError(message: string | undefined): string {
  if (!message) return "Erro desconhecido.";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (m.includes("already registered") || m.includes("already exists"))
    return "Este e-mail ja esta cadastrado.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um minuto.";
  if (m.includes("password should be at least"))
    return "A senha deve ter ao menos 6 caracteres.";
  return message;
}

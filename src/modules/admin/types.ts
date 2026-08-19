export interface AdminUser {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  banned_until: string | null;
  is_master: boolean;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  organization_id: string | null;
  organization_name: string | null;
  trial_ends_at: string | null;
  plan_code: string | null;
}

export interface CreateUserInput {
  email: string;
  full_name?: string;
  farm_name?: string;
  phone?: string;
  password?: string;
  invite?: boolean;
}

/** Organização no painel Master (Etapa 4 — docs/ORGANIZACOES-E-PERFIS.md). */
export interface AdminOrg {
  id: string;
  name: string;
  cnpj: string | null;
  kind: "individual" | "company";
  seats_limit: number;
  seats_used: number;
  plan_code: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

export interface AdminOrgMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  phone: string | null;
  /** Quantos lançamentos essa pessoa cadastrou nesta organização. */
  receipts: number;
  created_at: string;
}

export interface AdminOrgFormerMember {
  user_id: string;
  full_name: string | null;
  removed_at: string;
}

export interface AdminOrgDetail {
  organization: AdminOrg;
  members: AdminOrgMember[];
  former_members: AdminOrgFormerMember[];
}

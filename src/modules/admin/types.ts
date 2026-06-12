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

/** App role: nursing (nurse tabs only), provider (provider tab only), admin (full + user management). */
export type AppRole = "nursing" | "provider" | "admin";

export interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

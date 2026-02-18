import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

/** GET: list all users (auth + profiles). Admin only. */
export async function GET(request: NextRequest) {
  const admin = await assertAdmin(request);
  if ("error" in admin) return admin.error;
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Admin API not configured" }, { status: 503 });
  }
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    const authUsers = authData?.users ?? [];
    const profiles =
      (await supabaseAdmin.from("profiles").select("user_id, email, display_name, role, is_active, updated_at"))
        .data ?? [];
    const byId = new Map(profiles.map((p) => [p.user_id, p]));
    const users = authUsers.map((u) => ({
      id: u.id,
      email: u.email ?? undefined,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? undefined,
      banned_until: (u as { banned_until?: string }).banned_until ?? undefined,
      role: byId.get(u.id)?.role ?? "nursing",
      display_name: byId.get(u.id)?.display_name ?? null,
      is_active: byId.get(u.id)?.is_active ?? true,
      profile_updated_at: byId.get(u.id)?.updated_at ?? null,
    }));
    return NextResponse.json({ users });
  } catch (e) {
    console.error("admin users list error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

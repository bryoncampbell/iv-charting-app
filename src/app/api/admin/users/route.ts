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
      (await supabaseAdmin.from("profiles").select(
        "user_id, email, display_name, role, is_active, updated_at, first_name, last_name, date_of_birth, phone, street_address, city, state, zip_code, license_type, license_number, license_state, license_expiry"
      )).data ?? [];
    const byId = new Map(profiles.map((p) => [p.user_id, p]));
    const users = authUsers.map((u) => {
      const p = byId.get(u.id);
      return {
        id: u.id,
        email: u.email ?? undefined,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? undefined,
        banned_until: (u as { banned_until?: string }).banned_until ?? undefined,
        role: p?.role ?? "nursing",
        display_name: p?.display_name ?? null,
        is_active: p?.is_active ?? true,
        profile_updated_at: p?.updated_at ?? null,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        date_of_birth: p?.date_of_birth ?? null,
        phone: p?.phone ?? null,
        street_address: p?.street_address ?? null,
        city: p?.city ?? null,
        state: p?.state ?? null,
        zip_code: p?.zip_code ?? null,
        license_type: p?.license_type ?? null,
        license_number: p?.license_number ?? null,
        license_state: p?.license_state ?? null,
        license_expiry: p?.license_expiry ?? null,
      };
    });
    return NextResponse.json({ users });
  } catch (e) {
    console.error("admin users list error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

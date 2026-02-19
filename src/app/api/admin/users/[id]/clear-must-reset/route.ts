import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

/** POST: clear must_reset_password for a user so they can use the app without being sent to set-password. Admin only. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await assertAdmin(request);
  if ("error" in admin) return admin.error;
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 });
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Admin API not configured" }, { status: 503 });
  }
  try {
    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(id);
    const appMeta = (existing?.user as { app_metadata?: Record<string, unknown> })?.app_metadata ?? {};
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      app_metadata: { ...appMeta, must_reset_password: false },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin clear-must-reset error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

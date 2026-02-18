import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

/** PATCH: update profile (role, display_name, is_active). Admin only. */
export async function PATCH(
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
    const body = await request.json();
    const updates: { role?: string; display_name?: string; is_active?: boolean; updated_at?: string } = {};
    if (typeof body.role === "string" && ["nursing", "provider", "admin"].includes(body.role)) {
      updates.role = body.role;
    }
    if (typeof body.display_name === "string") updates.display_name = body.display_name;
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("user_id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ profile: data });
  } catch (e) {
    console.error("admin user update error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

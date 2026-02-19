import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

/** PATCH: update profile (role, is_active, and profile fields). Admin only. */
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
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const roleValue = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
    if (["nursing", "provider", "admin"].includes(roleValue)) updates.role = roleValue;
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
    if (typeof body.first_name === "string") updates.first_name = body.first_name.trim() || null;
    if (typeof body.last_name === "string") updates.last_name = body.last_name.trim() || null;
    if (typeof body.date_of_birth === "string") updates.date_of_birth = body.date_of_birth.trim() || null;
    if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
    if (typeof body.street_address === "string") updates.street_address = body.street_address.trim() || null;
    if (typeof body.city === "string") updates.city = body.city.trim() || null;
    if (typeof body.state === "string") updates.state = body.state.trim() || null;
    if (typeof body.zip_code === "string") updates.zip_code = body.zip_code.trim() || null;
    if (typeof body.license_type === "string") updates.license_type = body.license_type.trim() || null;
    if (typeof body.license_number === "string") updates.license_number = body.license_number.trim() || null;
    if (typeof body.license_state === "string") updates.license_state = body.license_state.trim() || null;
    if (typeof body.license_expiry === "string") updates.license_expiry = body.license_expiry.trim() || null;
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

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

const PROFILE_COLUMNS =
  "user_id, email, first_name, last_name, date_of_birth, phone, street_address, city, state, zip_code, license_type, license_number, license_state, license_expiry, role, is_active, updated_at";

/** GET: current user's profile (for /profile page). */
export async function GET(request: NextRequest) {
  const auth = await getCurrentUserId(request);
  if ("error" in auth) return auth.error;
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json({ profile: data });
}

/** PATCH: update current user's profile (self-service). Only allows profile fields, not role/is_active. */
export async function PATCH(request: NextRequest) {
  const auth = await getCurrentUserId(request);
  if ("error" in auth) return auth.error;
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
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
      .eq("user_id", auth.userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ profile: data });
  } catch (e) {
    console.error("profile update error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

/** POST: deactivate user (set is_active = false; optionally ban in auth). Admin only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await assertAdmin(request);
  if ("error" in admin) return admin.error;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 });
  if (id === admin.userId) {
    return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
  }
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Admin API not configured" }, { status: 503 });
  }
  try {
    await supabaseAdmin.from("profiles").update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", id);
    const body = await request.json().catch(() => ({}));
    if (body.ban === true) {
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: "876000h" }); // 100 years
    }
    return NextResponse.json({ ok: true, message: "User deactivated" });
  } catch (e) {
    console.error("admin deactivate error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

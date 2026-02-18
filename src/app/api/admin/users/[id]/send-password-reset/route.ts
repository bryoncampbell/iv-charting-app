import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

/** POST: send password reset / magic link to user. Admin only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await assertAdmin(request);
  if ("error" in admin) return admin.error;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 });
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Admin API not configured" }, { status: 503 });
  }
  try {
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(id);
    if (!user?.user?.email) {
      return NextResponse.json({ error: "User not found or no email" }, { status: 404 });
    }
    const origin = request.nextUrl.origin;
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(user.user.email, {
      redirectTo: `${origin}/auth/callback`,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Password reset email sent" });
  } catch (e) {
    console.error("admin send-password-reset error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

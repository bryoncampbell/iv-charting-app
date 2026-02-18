import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

function getUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * POST: clear must_reset_password after user has set a new password.
 * Call with Authorization: Bearer <session>. Only the signed-in user can clear their own flag.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = getUserIdFromJwt(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId);
    const appMeta = (existing?.user as { app_metadata?: Record<string, unknown> })?.app_metadata ?? {};
    if (!appMeta.must_reset_password) {
      return NextResponse.json({ ok: true });
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { ...appMeta, must_reset_password: false },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("clear-must-reset error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";
import type { AppRole } from "@/types/profile";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function sendWelcomeEmail(to: string, tempPassword: string, appName: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "RevIVe <onboarding@resend.dev>";
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: from.startsWith("RevIVe") ? from : `RevIVe <${from}>`,
        to: [to],
        subject: `Your ${appName} account`,
        html: `<p>An administrator has created an account for you.</p>
<p><strong>Email:</strong> ${to}</p>
<p><strong>Temporary password:</strong> ${tempPassword}</p>
<p>You must sign in and set a new password on first use. Do not share this email.</p>
<p>Sign in at: ${process.env.NEXT_PUBLIC_APP_URL || "[your app URL]"}/login</p>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** POST: create user with temporary password. Admin only. Sends email if RESEND_API_KEY is set. */
export async function POST(request: NextRequest) {
  const admin = await assertAdmin(request);
  if ("error" in admin) return admin.error;
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Admin API not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    const displayName = typeof body.display_name === "string" ? body.display_name.trim() : undefined;
    const role = typeof body.role === "string" && ["nursing", "provider", "admin"].includes(body.role)
      ? (body.role as AppRole)
      : "nursing";

    const tempPassword = generateTempPassword();
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: displayName ?? null, role },
      app_metadata: { must_reset_password: true },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!newUser?.user) return NextResponse.json({ error: "User not created" }, { status: 500 });

    const emailSent = await sendWelcomeEmail(email, tempPassword, "RevIVe Hydration and Recovery");

    return NextResponse.json({
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        role,
        display_name: displayName ?? null,
      },
      temporary_password: tempPassword,
      email_sent: emailSent,
      message: emailSent
        ? "User created. A welcome email with the temporary password was sent."
        : "User created. Send the temporary password to the user (configure RESEND_API_KEY to send email automatically).",
    });
  } catch (e) {
    console.error("admin create user error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

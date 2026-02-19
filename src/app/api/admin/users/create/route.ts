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
    const roleInput = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
    const role = ["nursing", "provider", "admin"].includes(roleInput) ? (roleInput as AppRole) : "nursing";
    const first_name = typeof body.first_name === "string" ? body.first_name.trim() || null : null;
    const last_name = typeof body.last_name === "string" ? body.last_name.trim() || null : null;
    const date_of_birth = typeof body.date_of_birth === "string" ? body.date_of_birth.trim() || null : null;
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
    const street_address = typeof body.street_address === "string" ? body.street_address.trim() || null : null;
    const city = typeof body.city === "string" ? body.city.trim() || null : null;
    const state = typeof body.state === "string" ? body.state.trim() || null : null;
    const zip_code = typeof body.zip_code === "string" ? body.zip_code.trim() || null : null;
    const license_type = typeof body.license_type === "string" ? body.license_type.trim() || null : null;
    const license_number = typeof body.license_number === "string" ? body.license_number.trim() || null : null;
    const license_state = typeof body.license_state === "string" ? body.license_state.trim() || null : null;
    const license_expiry = typeof body.license_expiry === "string" ? body.license_expiry.trim() || null : null;

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

    await supabaseAdmin.from("profiles").update({
      email,
      display_name: displayName ?? ([first_name, last_name].filter(Boolean).join(" ") || null),
      first_name,
      last_name,
      date_of_birth: date_of_birth || null,
      phone,
      street_address,
      city,
      state,
      zip_code,
      license_type,
      license_number,
      license_state,
      license_expiry: license_expiry || null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", newUser.user.id);

    const emailSent = await sendWelcomeEmail(email, tempPassword, "RevIVe Hydration and Recovery");

    return NextResponse.json({
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        role,
        display_name: displayName ?? ([first_name, last_name].filter(Boolean).join(" ") || null),
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

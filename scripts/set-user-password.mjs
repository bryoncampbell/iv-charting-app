#!/usr/bin/env node
/**
 * One-time script to set a user's password via Supabase Admin API (no email).
 * Run when locked out (e.g. rate limit on password reset).
 *
 * Usage:
 *   node scripts/set-user-password.mjs <user-id> <new-password>
 *
 * Get user-id from Supabase Dashboard → Authentication → Users (User UID).
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 * (or pass as env vars when running).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();

const userId = process.argv[2];
const newPassword = process.argv[3];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!userId || !newPassword) {
  console.error("Usage: node scripts/set-user-password.mjs <user-id> <new-password>");
  console.error("Get user-id from Supabase Dashboard → Authentication → Users (User UID).");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set in .env.local or env.");
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!anonKey) {
  console.error("Missing anon/publishable key in .env.local (needed to verify login).");
  process.exit(1);
}

const supabaseAdmin = createClient(url, serviceKey, { auth: { persistSession: false } });
const supabaseAnon = createClient(url, anonKey, { auth: { persistSession: false } });

// Get user email first so we can verify
const { data: userData, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
if (fetchError || !userData?.user) {
  console.error("User not found. Check the User UID from Supabase → Authentication → Users.");
  if (fetchError) console.error("Error:", fetchError.message);
  process.exit(1);
}
const email = userData.user.email;
if (userData.user.banned_until) {
  console.error("This user is banned. In Supabase → Authentication → Users, unban the user first.");
  process.exit(1);
}

const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });

if (error) {
  console.error("Error updating password:", error.message);
  process.exit(1);
}
console.log("Password updated for:", email);

// Verify login works
const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({ email, password: newPassword });
if (signInError) {
  console.error("Warning: password was set but sign-in check failed:", signInError.message);
  console.log("Try signing in at the app with:", email, "and your new password.");
  process.exit(0);
}
console.log("Sign-in verified. Use this in the app:");
console.log("  Email:", email);
console.log("  Password: (the password you just set)");

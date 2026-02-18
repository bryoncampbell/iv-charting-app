/**
 * Verify the request is from an authenticated admin. Use in API routes only.
 * Pass the request; returns { error } or { userId }.
 * Uses service role to read profile so RLS cannot block the admin check.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/** Returns current user id from Bearer token, or { error }. Use for self-service routes (e.g. profile). */
export async function getCurrentUserId(
  request: NextRequest
): Promise<{ error: NextResponse } | { userId: string }> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !supabaseUrl || !anonKey) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: user.id };
}

export async function assertAdmin(
  request: NextRequest
): Promise<{ error: NextResponse } | { userId: string }> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !supabaseUrl || !anonKey) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await client.auth.getUser(token);
  if (userError || !user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  // Use service role to read profile so RLS cannot block (e.g. on Vercel with same DB)
  const profileResult = supabaseAdmin
    ? await supabaseAdmin.from("profiles").select("user_id, role, is_active").eq("user_id", user.id).maybeSingle()
    : await client.from("profiles").select("user_id, role, is_active").eq("user_id", user.id).maybeSingle();
  const { data: profile, error: profileError } = profileResult;
  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (profile.role !== "admin" || !profile.is_active) {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }
  return { userId: profile.user_id };
}

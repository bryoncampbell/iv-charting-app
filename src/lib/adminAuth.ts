/**
 * Verify the request is from an authenticated admin. Use in API routes only.
 * Pass the request; returns { error } or { userId }.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

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
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("user_id, role, is_active")
    .limit(1)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (profile.role !== "admin" || !profile.is_active) {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }
  return { userId: profile.user_id };
}

/**
 * GET /api/patients – list all patients for any authenticated user.
 * Uses service role so RLS does not restrict by created_by; any user can search established patients.
 */

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/adminAuth";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const auth = await getCurrentUserId(request as import("next/server").NextRequest);
  if ("error" in auth) return auth.error;

  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured for patient list" },
      { status: 503 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("api/patients GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

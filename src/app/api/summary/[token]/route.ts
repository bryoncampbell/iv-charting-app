import { NextRequest, NextResponse } from "next/server";
import { getShareSummary } from "@/lib/share-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  const data = await getShareSummary(token);
  if (!data) {
    return NextResponse.json({ error: "Summary not found or link expired" }, { status: 404 });
  }
  return NextResponse.json(data);
}

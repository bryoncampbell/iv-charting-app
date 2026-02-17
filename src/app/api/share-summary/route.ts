import { NextRequest, NextResponse } from "next/server";
import { createShareToken } from "@/lib/share-store";

/** Normalize to E.164 for Twilio (US: +1XXXXXXXXXX) */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { encounter, patient, patientCellPhone } = body;
    if (!encounter || typeof encounter !== "object") {
      return NextResponse.json({ ok: false, error: "encounter required" }, { status: 400 });
    }
    // Deep clone so we store a plain, complete copy (all nested fields preserved)
    const payload = JSON.parse(JSON.stringify({
      encounter,
      patient: patient || null,
    }));
    const token = createShareToken(payload);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const url = `${baseUrl}/summary/${token}`;

    let smsSent = false;
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    const cell = typeof patientCellPhone === "string" ? patientCellPhone.trim() : "";

    if (twilioAccountSid && twilioAuthToken && twilioFrom && cell) {
      try {
        const message = `Your RevIVe visit summary is ready. View it here (secure link): ${url}`;
        const to = toE164(cell);
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: "Basic " + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64"),
            },
            body: new URLSearchParams({
              To: to,
              From: twilioFrom,
              Body: message,
            }),
          }
        );
        if (res.ok) smsSent = true;
      } catch {
        // SMS failed; caller can still open sms: with link
      }
    }

    return NextResponse.json({
      ok: true,
      url,
      token,
      smsSent,
    });
  } catch (e) {
    console.error("share-summary error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

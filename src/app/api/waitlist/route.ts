import { NextResponse } from "next/server";
import { Resend } from "resend";

const NOTIFY_TO = "heybuffi@gmail.com";

/**
 * POST /api/waitlist — send internal notification after a successful client-side Firestore waitlist write.
 * Idempotent from the user's perspective: failures are logged; response stays successful so the UI never regresses.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const firstName = typeof (body as { firstName?: unknown }).firstName === "string"
    ? (body as { firstName: string }).firstName.trim()
    : "";
  const email = typeof (body as { email?: unknown }).email === "string"
    ? (body as { email: string }).email.trim().toLowerCase()
    : "";

  if (!firstName || !email) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[api/waitlist] RESEND_API_KEY is not set; skip notification email");
    return NextResponse.json({ ok: true, notified: false });
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Buffi Waitlist <onboarding@resend.dev>";
  const signedUpAt = new Date().toISOString();
  const text = `Name: ${firstName}\nEmail: ${email}\nSigned up: ${signedUpAt}`;

  let notified = false;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [NOTIFY_TO],
      subject: "New Buffi waitlist signup",
      text
    });

    if (error) {
      console.error("[api/waitlist] Resend error:", error);
    } else {
      notified = true;
    }
  } catch (e) {
    console.error("[api/waitlist] Resend send failed:", e);
  }

  return NextResponse.json({ ok: true, notified });
}

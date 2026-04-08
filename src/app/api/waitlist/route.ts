import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminFirestore } from "@/lib/firebase/admin";

const NOTIFY_TO = "heybuffi@gmail.com";
const WAITLIST_COLLECTION = "waitlist";

/**
 * POST /api/waitlist — persist signup (Admin Firestore, bypasses client rules),
 * then send optional Resend notification. Duplicate emails return { duplicate: true }.
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

  const db = getAdminFirestore();
  if (!db) {
    console.error("[api/waitlist] FIREBASE_SERVICE_ACCOUNT_JSON not set — cannot persist waitlist");
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "Waitlist storage is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const col = db.collection(WAITLIST_COLLECTION);
    const existing = await col.where("email", "==", email).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ ok: true, duplicate: true, notified: false });
    }

    await col.add({
      firstName,
      email,
      joinedAt: FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error("[api/waitlist] Firestore write failed:", e);
    return NextResponse.json(
      { ok: false, error: "write_failed", message: "Could not save your signup. Try again in a moment." },
      { status: 500 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  let notified = false;
  if (!apiKey) {
    console.warn("[api/waitlist] RESEND_API_KEY is not set; skip notification email");
  } else {
    const from =
      process.env.RESEND_FROM_EMAIL?.trim() || "Buffi Waitlist <onboarding@resend.dev>";
    const signedUpAt = new Date().toISOString();
    const text = `Name: ${firstName}\nEmail: ${email}\nSigned up: ${signedUpAt}`;
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
    } catch (err) {
      console.error("[api/waitlist] Resend send failed:", err);
    }
  }

  return NextResponse.json({ ok: true, duplicate: false, notified });
}

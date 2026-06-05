import { NextResponse } from "next/server";
import { normalizeAuthEmail } from "@/lib/auth/demoAccount";
import type { OnboardingAnswersPayload } from "@/lib/auth/onboardingAnswersPayload";
import { hasOnboardingPayloadAnswers } from "@/lib/auth/onboardingAnswersPayload";
import { savePendingOnboardingForEmail } from "@/lib/auth/pendingOnboardingServer";
import { getAdminAuth } from "@/lib/firebase/admin";
import { applyPendingOnboardingForUser } from "@/lib/auth/pendingOnboardingServer";

export const dynamic = "force-dynamic";

function parseAnswers(body: unknown): OnboardingAnswersPayload | null {
  if (!body || typeof body !== "object") return null;
  const answers = (body as { answers?: unknown }).answers;
  if (!answers || typeof answers !== "object") return null;
  return answers as OnboardingAnswersPayload;
}

/**
 * POST /api/onboarding-pending
 * - { email, answers } — save quiz answers before magic-link signup (same device may lose localStorage in mail app).
 * - Authorization header — apply saved answers to the signed-in user after link click.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (token) {
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
    }

    let uid: string;
    let email: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email?.trim().toLowerCase() ?? "";
    } catch {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!email) {
      return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
    }

    const applied = await applyPendingOnboardingForUser(uid, email);
    return NextResponse.json({ ok: true, applied });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const email =
    typeof (body as { email?: unknown }).email === "string"
      ? normalizeAuthEmail((body as { email: string }).email)
      : "";
  const answers = parseAnswers(body);

  if (!email || !answers || !hasOnboardingPayloadAnswers(answers)) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const saved = await savePendingOnboardingForEmail(email, answers);
  if (!saved) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

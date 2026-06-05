import {
  collectOnboardingAnswersFromStorage,
  hasOnboardingPayloadAnswers
} from "@/lib/auth/onboardingAnswersPayload";
import { normalizeAuthEmail } from "@/lib/auth/demoAccount";

export async function savePendingOnboardingForEmail(email: string): Promise<void> {
  const answers = collectOnboardingAnswersFromStorage();
  if (!hasOnboardingPayloadAnswers(answers)) return;

  const normalized = normalizeAuthEmail(email);
  if (!normalized) return;

  try {
    await fetch("/api/onboarding-pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalized, answers })
    });
  } catch {
    /* non-fatal — callback may still use localStorage on same browser */
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { normalizeAuthEmail } from "@/lib/auth/demoAccount";
import type { OnboardingAnswersPayload } from "@/lib/auth/onboardingAnswersPayload";
import { onboardingPayloadToProfilePatch } from "@/lib/auth/onboardingAnswersPayload";
import { getAdminFirestore } from "@/lib/firebase/admin";

const COLLECTION = "pendingOnboarding";

export async function savePendingOnboardingForEmail(
  email: string,
  answers: OnboardingAnswersPayload
): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  const normalized = normalizeAuthEmail(email);
  if (!normalized) return false;

  await db.collection(COLLECTION).doc(normalized).set({
    email: normalized,
    answers,
    savedAt: FieldValue.serverTimestamp()
  });

  return true;
}

export async function applyPendingOnboardingForUser(
  uid: string,
  email: string
): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  const normalized = normalizeAuthEmail(email);
  if (!normalized) return false;

  const ref = db.collection(COLLECTION).doc(normalized);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const data = snap.data() as { answers?: OnboardingAnswersPayload } | undefined;
  const answers = data?.answers;
  if (!answers) {
    await ref.delete();
    return false;
  }

  const patch = onboardingPayloadToProfilePatch(answers);
  if (Object.keys(patch).length === 0) {
    await ref.delete();
    return false;
  }

  await db.collection("users").doc(uid).set(
    {
      ...patch,
      email: normalized,
      onboardingComplete: true,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await ref.delete();
  return true;
}

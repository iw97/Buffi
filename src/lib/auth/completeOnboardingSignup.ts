import { clearObAnswers, OB_KEYS } from "@/lib/auth/onboardingAnswers";
import {
  collectOnboardingAnswersFromStorage,
  onboardingPayloadToProfilePatch
} from "@/lib/auth/onboardingAnswersPayload";
import { setUserProfile } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase";
import { auth } from "@/lib/firebase";

/** Restore server-stored quiz answers (mail app / new tab) then flush any local copies. */
export async function completeOnboardingSignup(
  uid: string,
  email: string,
  authDisplayName?: string | null
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  let appliedFromServer = false;

  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/onboarding-pending", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = (await res.json()) as { applied?: boolean };
        appliedFromServer = Boolean(data.applied);
      }
    } catch {
      /* fall back to local flush */
    }
  }

  if (!appliedFromServer && isFirebaseConfigured()) {
    const local = collectOnboardingAnswersFromStorage();
    const patch = onboardingPayloadToProfilePatch(local, {
      skipDisplayName: Boolean(authDisplayName?.trim())
    });
    if (Object.keys(patch).length > 0) {
      await setUserProfile(uid, { ...patch, onboardingComplete: true });
    } else {
      await setUserProfile(uid, { onboardingComplete: true });
    }
    if (typeof window !== "undefined") {
      OB_KEYS.forEach((k) => localStorage.removeItem(k));
    }
  } else if (typeof window !== "undefined") {
    clearObAnswers();
  }
}

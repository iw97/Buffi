import type { UserProfile } from "@/lib/firebase/types";
import { getObAnswer, type ObKey } from "@/lib/auth/onboardingAnswers";

export type OnboardingAnswersPayload = {
  name?: string | null;
  regret?: string | null;
  quality?: string | null;
  awareness?: string | null;
  shopperType?: string | null;
  valuesSelected?: string[];
  priorities?: Record<string, number>;
};

export function collectOnboardingAnswersFromStorage(): OnboardingAnswersPayload {
  if (typeof window === "undefined") return {};

  const name = getObAnswer("buffi_ob_name")?.trim() || null;
  const regret = getObAnswer("buffi_ob_regret") || null;
  const quality = getObAnswer("buffi_ob_quality") || null;
  const awareness = getObAnswer("buffi_ob_awareness") || null;
  const shopperType = getObAnswer("buffi_ob_shopper") || null;

  let valuesSelected: string[] | undefined;
  try {
    const raw = getObAnswer("buffi_ob_values");
    if (raw) valuesSelected = JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }

  let priorities: Record<string, number> | undefined;
  try {
    const raw = getObAnswer("buffi_ob_priorities");
    if (raw) priorities = JSON.parse(raw) as Record<string, number>;
  } catch {
    /* ignore */
  }

  return {
    name,
    regret,
    quality,
    awareness,
    shopperType,
    valuesSelected,
    priorities
  };
}

export function onboardingPayloadToProfilePatch(
  payload: OnboardingAnswersPayload,
  options?: { skipDisplayName?: boolean }
): Partial<UserProfile> {
  const patch: Partial<UserProfile> = {};
  if (payload.regret) patch.onboardingRegret = payload.regret;
  if (payload.quality) patch.onboardingQuality = payload.quality;
  if (payload.awareness) patch.onboardingAwareness = payload.awareness;
  if (payload.shopperType) patch.shopperType = payload.shopperType;
  if (payload.valuesSelected?.length) patch.valuesSelected = payload.valuesSelected;
  if (payload.priorities && Object.keys(payload.priorities).length > 0) {
    patch.priorities = payload.priorities;
  }
  if (payload.name && !options?.skipDisplayName) {
    patch.displayName = payload.name;
  }
  return patch;
}

export function hasOnboardingPayloadAnswers(payload: OnboardingAnswersPayload): boolean {
  return Boolean(payload.shopperType?.trim());
}

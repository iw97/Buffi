/** Canonical onboarding route order — used for swipe direction. */
export const ONBOARDING_STEP_ORDER = [
  "intro",
  "welcome",
  "regret",
  "quality",
  "awareness",
  "values",
  "priorities",
  "shopper",
  "reflection",
  "account",
  "budget",
] as const;

export function onboardingStepIndex(pathname: string): number {
  const step = pathname.split("/").filter(Boolean).pop() ?? "";
  const idx = ONBOARDING_STEP_ORDER.indexOf(step as (typeof ONBOARDING_STEP_ORDER)[number]);
  return idx === -1 ? 0 : idx;
}

export function firstNameFromOnboardingName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

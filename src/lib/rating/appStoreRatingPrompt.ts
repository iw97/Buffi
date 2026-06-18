import type { UserProfile } from "@/lib/firebase/types";
import type { ScanAnalysis } from "@/lib/scan/types";

export const APP_STORE_RATING_SAVINGS_MILESTONE = 50;
export const APP_STORE_RATING_PROMPT_DELAY_MS = 1500;
export const APP_STORE_RATING_MIN_COMPLETED_SCANS = 3;

export function isEligibleForAppStoreRatingPrompt(params: {
  profile: UserProfile | null | undefined;
  verdict: ScanAnalysis["verdict"] | undefined;
  baselineEstimatedMoneySaved: number;
}): boolean {
  const { profile, verdict, baselineEstimatedMoneySaved } = params;
  if (!profile || profile.hasSeenRatingPrompt === true) return false;

  const completedScans = profile.completedScans ?? 0;
  if (completedScans < APP_STORE_RATING_MIN_COMPLETED_SCANS) return false;

  const worthIt = verdict === "Worth It";
  const currentSavings = profile.estimatedMoneySaved ?? 0;
  const crossedSavings =
    baselineEstimatedMoneySaved < APP_STORE_RATING_SAVINGS_MILESTONE &&
    currentSavings >= APP_STORE_RATING_SAVINGS_MILESTONE;

  return worthIt || crossedSavings;
}

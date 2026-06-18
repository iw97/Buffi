"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setUserProfile } from "@/lib/firebase/firestore";
import type { UserProfile } from "@/lib/firebase/types";
import {
  APP_STORE_RATING_PROMPT_DELAY_MS,
  isEligibleForAppStoreRatingPrompt
} from "@/lib/rating/appStoreRatingPrompt";
import type { ScanAnalysis } from "@/lib/scan/types";

type UseAppStoreRatingPromptOptions = {
  uid: string | undefined;
  profile: UserProfile | null | undefined;
  validResult: ScanAnalysis | null;
  /** Breakdown content is ready (not loading / redirecting). */
  breakdownReady: boolean;
};

/**
 * Schedules the App Store rating pre-screen once per user when they hit engagement milestones
 * on the breakdown screen (3+ scans + Worth It verdict or $50+ estimated savings crossed).
 */
export function useAppStoreRatingPrompt({
  uid,
  profile,
  validResult,
  breakdownReady
}: UseAppStoreRatingPromptOptions) {
  const [preScreenOpen, setPreScreenOpen] = useState(false);
  const baselineSavingsRef = useRef<number | null>(null);
  const scheduledRef = useRef(false);
  const markedSeenRef = useRef(false);

  const closePreScreen = useCallback(() => setPreScreenOpen(false), []);

  useEffect(() => {
    if (baselineSavingsRef.current === null && profile) {
      baselineSavingsRef.current = profile.estimatedMoneySaved ?? 0;
    }
  }, [profile]);

  useEffect(() => {
    if (!breakdownReady || !uid || !validResult || scheduledRef.current) return;

    const baselineSavings = baselineSavingsRef.current ?? profile?.estimatedMoneySaved ?? 0;
    if (
      !isEligibleForAppStoreRatingPrompt({
        profile,
        verdict: validResult.verdict,
        baselineEstimatedMoneySaved: baselineSavings
      })
    ) {
      return;
    }

    scheduledRef.current = true;
    const timer = window.setTimeout(() => {
      setPreScreenOpen(true);
      if (!markedSeenRef.current) {
        markedSeenRef.current = true;
        void setUserProfile(uid, { hasSeenRatingPrompt: true }).catch((err) => {
          console.warn("[rating] failed to persist hasSeenRatingPrompt", err);
        });
      }
    }, APP_STORE_RATING_PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    breakdownReady,
    uid,
    profile,
    validResult,
    profile?.completedScans,
    profile?.estimatedMoneySaved,
    profile?.hasSeenRatingPrompt,
    validResult?.verdict
  ]);

  return { preScreenOpen, closePreScreen };
}

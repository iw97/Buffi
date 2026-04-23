"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";

/**
 * Redirects to sign-up when Firebase is configured and there is no user.
 * `returnTo` must be an app-internal path (e.g. /scan).
 */
export function useRequireAuth(returnTo: string): void {
  const router = useRouter();
  const auth = useAuthOptional();
  const loading = auth?.loading ?? true;
  const user = auth?.user ?? null;
  const isConfigured = auth?.isConfigured ?? false;

  useEffect(() => {
    if (!isConfigured) return;
    if (loading) return;
    if (!user) {
      const params = new URLSearchParams({ returnTo });
      router.replace(`/onboarding/intro?${params.toString()}`);
    }
  }, [isConfigured, loading, user, router, returnTo]);
}

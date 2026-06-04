"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  hasSeenLaunchSplash,
  shouldShowLaunchSplash
} from "@/lib/launchSplash";

/**
 * On first install / first open, redirect to /splash before any other screen.
 */
export function LaunchSplashGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pendingRedirect = useRef(false);

  useEffect(() => {
    if (pendingRedirect.current) return;
    if (hasSeenLaunchSplash()) return;
    if (!shouldShowLaunchSplash(pathname)) return;

    pendingRedirect.current = true;
    router.replace("/splash");
  }, [pathname, router]);

  return <>{children}</>;
}

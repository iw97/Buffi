"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markLaunchSplashSeen, POST_SPLASH_PATH } from "@/lib/launchSplash";

const DISPLAY_MS = 2200;

export function LaunchSplashScreen() {
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      markLaunchSplashSeen();
      router.replace(POST_SPLASH_PATH);
    }, DISPLAY_MS);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div className="launch-splash" aria-hidden={false}>
      <div className="launch-splash-center">
        <div className="launch-splash-wordmark">
          Buffi<span>.</span>
        </div>
        <p className="launch-splash-subline">Material Intelligence</p>
      </div>
    </div>
  );
}

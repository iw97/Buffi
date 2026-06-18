"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markLaunchSplashSeen, POST_SPLASH_PATH } from "@/lib/launchSplash";
import { useAuthOptional } from "@/contexts/AuthContext";

const DISPLAY_MS = 2200;

export function LaunchSplashScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const [timerDone, setTimerDone] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimerDone(true), DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!timerDone) return;
    if (auth?.isConfigured && auth?.loading) return;
    if (hasNavigated.current) return;

    hasNavigated.current = true;
    markLaunchSplashSeen();
    router.replace(auth?.user ? "/scan" : POST_SPLASH_PATH);
  }, [timerDone, auth?.loading, auth?.user, auth?.isConfigured, router]);

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

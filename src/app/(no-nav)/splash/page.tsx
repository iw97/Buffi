import { Suspense } from "react";
import { LaunchSplashScreen } from "@/components/screens/LaunchSplashScreen";

export default function SplashPage() {
  return (
    <Suspense
      fallback={
        <div className="launch-splash" aria-busy>
          <div className="launch-splash-center">
            <div className="launch-splash-wordmark">
              Buffi<span>.</span>
            </div>
            <p className="launch-splash-subline">Material Intelligence</p>
          </div>
        </div>
      }
    >
      <LaunchSplashScreen />
    </Suspense>
  );
}

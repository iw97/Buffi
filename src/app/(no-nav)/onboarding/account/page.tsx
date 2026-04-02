import { Suspense } from "react";
import { OnboardingAccountScreen } from "@/components/screens/OnboardingAccountScreen";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
            Loading…
          </p>
        </div>
      }
    >
      <OnboardingAccountScreen />
    </Suspense>
  );
}


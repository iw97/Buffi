import { Suspense } from "react";
import { OnboardingPersonalizedScreen } from "@/components/screens/OnboardingPersonalizedScreen";

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
      <OnboardingPersonalizedScreen />
    </Suspense>
  );
}

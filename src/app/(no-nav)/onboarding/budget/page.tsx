import { Suspense } from "react";
import { OnboardingBudgetScreen } from "@/components/screens/OnboardingBudgetScreen";

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
      <OnboardingBudgetScreen />
    </Suspense>
  );
}

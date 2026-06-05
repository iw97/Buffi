import { Suspense } from "react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { OnboardingGate } from "@/components/auth/OnboardingGate";

export default function NavLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Suspense fallback={null}>
        <OnboardingGate />
      </Suspense>
      <div className="min-h-screen pb-[84px]">{children}</div>
      <BottomNav />
    </div>
  );
}


"use client";

import { AnimatePresence } from "framer-motion";
import { currentOnboardingDirection } from "@/lib/onboardingDirection";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", height: "100dvh" }}>
      <AnimatePresence initial={false} custom={currentOnboardingDirection}>
        {children}
      </AnimatePresence>
    </div>
  );
}

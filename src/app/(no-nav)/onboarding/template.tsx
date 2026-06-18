"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { onboardingStepIndex } from "@/lib/auth/onboardingSteps";
import { currentOnboardingDirection, setOnboardingDirection } from "@/lib/onboardingDirection";

const pageVariants = {
  enter: (dir: 1 | -1) => ({ x: `${dir * 100}%` }),
  center: { x: 0 },
  exit: (dir: 1 | -1) => ({ x: `${dir * -100}%` }),
};

const pageTransition = {
  type: "spring" as const,
  stiffness: 350,
  damping: 35,
  mass: 0.8,
};

export default function OnboardingTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevIdxRef = useRef(onboardingStepIndex(pathname));

  const currIdx = onboardingStepIndex(pathname);
  if (currIdx !== prevIdxRef.current) {
    setOnboardingDirection(currIdx > prevIdxRef.current ? 1 : -1);
    prevIdxRef.current = currIdx;
  }

  return (
    <motion.div
      key={pathname}
      custom={currentOnboardingDirection}
      variants={pageVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={pageTransition}
      style={{ position: "absolute", inset: 0, overflowY: "auto" }}
    >
      {children}
    </motion.div>
  );
}

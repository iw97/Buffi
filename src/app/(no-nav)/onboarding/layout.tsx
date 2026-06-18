"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { onboardingStepIndex } from "@/lib/auth/onboardingSteps";

const variants = {
  enter: (dir: 1 | -1) => ({ x: `${dir * 100}%` }),
  center: { x: 0 },
  exit: (dir: 1 | -1) => ({ x: `${dir * -100}%` }),
};

const transition = {
  type: "spring" as const,
  stiffness: 350,
  damping: 35,
  mass: 0.8,
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevIdxRef = useRef(onboardingStepIndex(pathname));
  const dirRef = useRef<1 | -1>(1);

  const currIdx = onboardingStepIndex(pathname);
  if (currIdx !== prevIdxRef.current) {
    dirRef.current = currIdx > prevIdxRef.current ? 1 : -1;
    prevIdxRef.current = currIdx;
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", height: "100dvh" }}>
      <AnimatePresence initial={false} custom={dirRef.current}>
        <motion.div
          key={pathname}
          custom={dirRef.current}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          style={{ position: "absolute", inset: 0, overflowY: "auto" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

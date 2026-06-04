"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { onboardingStepIndex } from "@/lib/auth/onboardingSteps";

type Direction = "forward" | "back";

export function OnboardingPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [direction, setDirection] = useState<Direction>("forward");
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const prev = prevPathRef.current;
    if (prev === pathname) return;

    const prevIdx = onboardingStepIndex(prev);
    const nextIdx = onboardingStepIndex(pathname);
    setDirection(nextIdx >= prevIdx ? "forward" : "back");
    setAnimate(true);
    prevPathRef.current = pathname;
  }, [pathname]);

  const className = animate
    ? `ob-page-transition ob-page-transition--${direction}`
    : "ob-page-transition ob-page-transition--initial";

  return (
    <div key={pathname} className={className}>
      {children}
    </div>
  );
}

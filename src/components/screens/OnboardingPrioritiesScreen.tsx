"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onboardingReturnToQuery } from "@/lib/auth/returnTo";

function labelFor(val: number) {
  return val >= 75 ? "High" : val >= 40 ? "Medium" : "Low";
}

export function OnboardingPrioritiesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepQ = onboardingReturnToQuery(searchParams);
  const [fiber, setFiber] = useState(85);
  const [price, setPrice] = useState(90);
  const [ethics, setEthics] = useState(55);
  const [env, setEnv] = useState(60);

  const progress = useMemo(
    () => (
      <div className="ob-progress">
        <div className="ob-pip done" />
        <div className="ob-pip active" />
        <div className="ob-pip" />
      </div>
    ),
    []
  );

  return (
    <div className="min-h-screen">
      <div className="ob-shell">
        {progress}

        <div className="ob-step-label">Step 2 of 3 · Priorities</div>
        <h2 className="ob-title">
          How do you
          <br />
          <em>weigh</em> these?
        </h2>
        <p className="ob-desc">
          Set how much each factor matters in your score. Adjust anytime in
          settings.
        </p>

        <div className="slider-rows">
          <div className="slider-row">
            <div className="slider-row-top">
              <span className="slider-name">Fiber quality</span>
              <span className="slider-val">{labelFor(fiber)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={fiber}
              onChange={(e) => setFiber(Number(e.target.value))}
            />
            <div className="slider-labels">
              <span>Not important</span>
              <span>Essential</span>
            </div>
          </div>

          <div className="slider-row">
            <div className="slider-row-top">
              <span className="slider-name">Price / value</span>
              <span className="slider-val">{labelFor(price)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <div className="slider-labels">
              <span>Not important</span>
              <span>Essential</span>
            </div>
          </div>

          <div className="slider-row">
            <div className="slider-row-top">
              <span className="slider-name">Brand ethics</span>
              <span className="slider-val">{labelFor(ethics)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={ethics}
              onChange={(e) => setEthics(Number(e.target.value))}
            />
            <div className="slider-labels">
              <span>Not important</span>
              <span>Essential</span>
            </div>
          </div>

          <div className="slider-row">
            <div className="slider-row-top">
              <span className="slider-name">Environmental impact</span>
              <span className="slider-val">{labelFor(env)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={env}
              onChange={(e) => setEnv(Number(e.target.value))}
            />
            <div className="slider-labels">
              <span>Not important</span>
              <span>Essential</span>
            </div>
          </div>
        </div>

        <div className="ob-nav">
          <button className="ob-back" type="button" onClick={() => router.push(`/onboarding/values${stepQ}`)}>
            ←
          </button>
          <button className="ob-next" type="button" onClick={() => router.push(`/onboarding/budget${stepQ}`)}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}


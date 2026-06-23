"use client";

import { useState } from "react";

interface FiberFallbackStepProps {
  brand: string;
  isZara: boolean;
  onSubmitFibers: (composition: string) => void;
  onScanTag: () => void;
  onSkip: () => void;
}

export function FiberFallbackStep({ brand, isZara, onSubmitFibers, onScanTag, onSkip }: FiberFallbackStepProps) {
  const [composition, setComposition] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = composition.trim();
    if (!trimmed) return;
    onSubmitFibers(trimmed);
  }

  const storeName = brand.trim() || "This store";

  return (
    <div className="tag-details-step">
      <h2 className="tag-details-title">Couldn&apos;t read fabric data</h2>
      <p className="tag-details-sub url-scrape-fallback-note">
        {isZara
          ? "Zara's website actively blocks automatic fabric scanning. Scan the physical tag on your garment for accurate results, or enter the composition below."
          : `${storeName}'s website doesn't share fabric composition data. Check the physical tag and enter it below, or scan it directly.`}
      </p>

      <form onSubmit={handleSubmit} className="tag-details-form">
        <label className="tag-details-label">
          Fiber composition
          <input
            type="text"
            className="tag-details-input"
            value={composition}
            onChange={(e) => setComposition(e.target.value)}
            placeholder="e.g. 60% Cotton, 40% Polyester"
          />
        </label>

        <div className="tag-details-actions">
          <button type="button" className="btn-secondary" onClick={onScanTag}>
            Scan tag
          </button>
          <button type="submit" className="btn-primary" disabled={!composition.trim()}>
            Analyze
          </button>
        </div>
      </form>

      <button type="button" className="scan-manual-link" onClick={onSkip}>
        Skip — show result without fabric data
      </button>
    </div>
  );
}

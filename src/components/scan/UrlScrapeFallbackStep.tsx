"use client";

import { useState } from "react";

interface UrlScrapeFallbackStepProps {
  brand: string;
  name: string;
  onBack: () => void;
  onSubmit: (payload: { brand: string; name: string; price?: number }) => void;
}

export function UrlScrapeFallbackStep({
  brand: initialBrand,
  name: initialName,
  onBack,
  onSubmit
}: UrlScrapeFallbackStepProps) {
  const [brandInput, setBrandInput] = useState(initialBrand);
  const [nameInput, setNameInput] = useState(initialName);
  const [priceInput, setPriceInput] = useState("");

  const brandLabel = brandInput.trim() || "This store";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const brand = brandInput.trim();
    const name = nameInput.trim();
    if (!brand || !name) return;
    const parsed = priceInput.trim() ? parseFloat(priceInput.replace(/[^0-9.]/g, "")) : undefined;
    const price = typeof parsed === "number" && parsed > 0 ? parsed : undefined;
    onSubmit({ brand, name, price });
  }

  return (
    <div className="tag-details-step">
      <button type="button" className="tag-details-back" onClick={onBack} aria-label="Back">
        ← Back
      </button>
      <h2 className="tag-details-title">Confirm product details</h2>
      <p className="tag-details-sub url-scrape-fallback-note">
        {brandLabel}&apos;s website prevented automatic reading. We&apos;ve filled in what we could from the
        URL — add the price to get your full breakdown.
      </p>

      <form onSubmit={handleSubmit} className="tag-details-form">
        <label className="tag-details-label">
          Brand
          <input
            type="text"
            className="tag-details-input"
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            required
          />
        </label>

        <label className="tag-details-label">
          Product name
          <input
            type="text"
            className="tag-details-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            required
          />
        </label>

        <label className="tag-details-label">
          Price (required for markup)
          <input
            type="text"
            inputMode="decimal"
            className="tag-details-input"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="e.g. 198.00"
          />
        </label>

        <div className="tag-details-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!brandInput.trim() || !nameInput.trim()}
          >
            Run analysis
          </button>
        </div>
      </form>
    </div>
  );
}

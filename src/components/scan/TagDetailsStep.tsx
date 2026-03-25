"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { FASHION_BRANDS } from "@/lib/scan/brands";

interface TagDetailsStepProps {
  initialComposition: string;
  onBack: () => void;
  onSubmit: (payload: { composition: string; brand?: string; price?: number }) => void;
}

export function TagDetailsStep({ initialComposition, onBack, onSubmit }: TagDetailsStepProps) {
  const [composition, setComposition] = useState(initialComposition);
  const [brandInput, setBrandInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [showBrandList, setShowBrandList] = useState(false);
  const brandListRef = useRef<HTMLDivElement>(null);

  const filteredBrands = useMemo(() => {
    const q = brandInput.trim().toLowerCase();
    if (!q) return FASHION_BRANDS.slice(0, 20);
    return FASHION_BRANDS.filter((b) => b.toLowerCase().includes(q)).slice(0, 20);
  }, [brandInput]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (brandListRef.current && !brandListRef.current.contains(e.target as Node)) {
        setShowBrandList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const comp = composition.trim();
    if (!comp) return;
    const brand = brandInput.trim() || undefined;
    const price = priceInput.trim() ? parseFloat(priceInput.replace(/[^0-9.]/g, "")) : undefined;
    onSubmit({
      composition: comp,
      brand: brand || undefined,
      price: typeof price === "number" && price > 0 ? price : undefined
    });
  }

  return (
    <div className="tag-details-step">
      <button type="button" className="tag-details-back" onClick={onBack} aria-label="Back">
        ← Back
      </button>
      <h2 className="tag-details-title">Add details for a better analysis</h2>
      <p className="tag-details-sub">Both fields are optional but help us give you markup and value insights.</p>

      <form onSubmit={handleSubmit} className="tag-details-form">
        <label className="tag-details-label">
          Composition (from label)
          <textarea
            className="tag-details-composition"
            value={composition}
            onChange={(e) => setComposition(e.target.value)}
            placeholder="e.g. Shell: 80% Polyester, 20% Elastane"
            rows={3}
            required
          />
        </label>

        <label className="tag-details-label">
          Brand (optional)
          <div className="tag-details-brand-wrap" ref={brandListRef}>
            <input
              type="text"
              className="tag-details-input"
              value={brandInput}
              onChange={(e) => {
                setBrandInput(e.target.value);
                setShowBrandList(true);
              }}
              onFocus={() => setShowBrandList(true)}
              placeholder="e.g. Zara, H&M"
              autoComplete="off"
            />
            {showBrandList && (
              <ul className="tag-details-brand-list" role="listbox">
                {filteredBrands.map((b) => (
                  <li
                    key={b}
                    role="option"
                    className="tag-details-brand-option"
                    onClick={() => {
                      setBrandInput(b);
                      setShowBrandList(false);
                    }}
                  >
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>

        <label className="tag-details-label">
          Price (optional) — retail or price tag
          <input
            type="text"
            inputMode="decimal"
            className="tag-details-input"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="e.g. 49.99"
          />
        </label>

        <div className="tag-details-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="btn-primary" disabled={!composition.trim()}>
            Run analysis
          </button>
        </div>
      </form>
    </div>
  );
}

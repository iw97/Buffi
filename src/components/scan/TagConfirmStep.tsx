"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { FASHION_BRANDS } from "@/lib/scan/brands";
import { useAuthOptional } from "@/contexts/AuthContext";

export interface TagExtraction {
  fibers: { fiber: string; percentage: number }[];
  countryOfManufacture: string | null;
  styleNumber: string | null;
  confidence: "high" | "medium" | "low";
}

interface TagConfirmStepProps {
  extraction: TagExtraction;
  onBack: () => void;
  onSubmit: (payload: { composition: string; brand: string; price?: number }) => void;
}

export function TagConfirmStep({ extraction, onBack, onSubmit }: TagConfirmStepProps) {
  const { fibers, styleNumber } = extraction;
  const auth = useAuthOptional();
  const [brandInput, setBrandInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [showBrandList, setShowBrandList] = useState(false);
  const [lookingUpPrice, setLookingUpPrice] = useState(false);
  const brandListRef = useRef<HTMLDivElement>(null);

  const composition = fibers.map((f) => `${f.fiber} ${f.percentage}%`).join(", ");

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const brand = brandInput.trim();
    if (!brand) return;

    let price: number | undefined;
    const priceFromInput = priceInput.trim() ? parseFloat(priceInput.replace(/[^0-9.]/g, "")) : undefined;
    if (typeof priceFromInput === "number" && priceFromInput > 0) {
      price = priceFromInput;
    } else if (styleNumber && auth?.user) {
      setLookingUpPrice(true);
      try {
        const token = await auth.user.getIdToken();
        const res = await fetch("/api/price-lookup", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ query: `${brand} ${styleNumber}` })
        });
        const data = (await res.json()) as { price: number | null };
        if (typeof data.price === "number" && data.price > 0) price = data.price;
      } finally {
        setLookingUpPrice(false);
      }
    }

    onSubmit({ composition, brand, price });
  }

  return (
    <div className="tag-details-step">
      <button type="button" className="tag-details-back" onClick={onBack} aria-label="Back">
        ← Back
      </button>
      <h2 className="tag-details-title">Confirm & add details</h2>
      <p className="tag-details-sub">We extracted this composition from your label. Brand is required for the full analysis.</p>

      <div className="tag-confirm-fibers">
        <div className="tag-confirm-fibers-label">Composition</div>
        <div className="tag-confirm-fibers-list">
          {fibers.length > 0 ? (
            fibers.map((f, i) => (
              <div key={i} className="tag-confirm-fiber-row">
                <span className="tag-confirm-fiber-name">{f.fiber}</span>
                <span className="tag-confirm-fiber-pct">{f.percentage}%</span>
              </div>
            ))
          ) : (
            <span className="tag-confirm-fibers-empty">No fibers extracted</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="tag-details-form">
        <label className="tag-details-label">
          Brand (required)
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
              required
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
          Price (optional)
          {styleNumber && (
            <span className="tag-confirm-price-hint">We&apos;ll try to find it from brand + style number if left blank.</span>
          )}
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
          <button type="submit" className="btn-primary" disabled={!brandInput.trim() || lookingUpPrice}>
            {lookingUpPrice ? "Looking up price…" : "Run analysis"}
          </button>
        </div>
      </form>
    </div>
  );
}

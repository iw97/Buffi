"use client";

import { GARMENT_CATEGORIES, type GarmentCategoryId } from "@/lib/scan/garmentCategories";

interface GarmentCategoryPickerProps {
  value: GarmentCategoryId | null;
  onChange: (id: GarmentCategoryId | null) => void;
}

export function GarmentCategoryPicker({ value, onChange }: GarmentCategoryPickerProps) {
  return (
    <div className="tag-details-label">
      <span className="tag-garment-type-label">Garment type</span>
      <p className="tag-garment-type-hint">Helps us find better alternatives</p>
      <div className="tag-garment-pills" role="group" aria-label="Garment type">
        {GARMENT_CATEGORIES.map((cat) => {
          const selected = value === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              className={`tag-garment-pill${selected ? " tag-garment-pill--selected" : ""}`}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : cat.id)}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

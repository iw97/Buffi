"use client";

import { useEffect } from "react";
import type { SavedItem } from "@/lib/firebase/types";
import { PETROLEUM_SYNTHETIC, PREMIUM_NATURAL, STANDARD_NATURAL, PREMIUM_CELLULOSIC, STANDARD_CELLULOSIC, DEFAULT_WEAR_COUNT } from "@/lib/scan/verdict";

const NATURAL_OR_CELLULOSIC = [
  ...PREMIUM_NATURAL,
  ...STANDARD_NATURAL,
  ...PREMIUM_CELLULOSIC,
  ...STANDARD_CELLULOSIC
];

type ParsedFiber = { fiber: string; percentage: number };

function parseSavedFibers(fibers: string[]): ParsedFiber[] {
  return fibers
    .map((entry) => {
      const match = entry.trim().match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%$/);
      if (!match) return null;
      const percentage = Number(match[2]);
      if (!Number.isFinite(percentage)) return null;
      return { fiber: match[1].trim(), percentage };
    })
    .filter((f): f is ParsedFiber => f != null);
}

function fiberKind(fiber: string): "synthetic" | "natural" {
  const lower = fiber.toLowerCase();
  if (PETROLEUM_SYNTHETIC.some((s) => lower.includes(s))) return "synthetic";
  if (NATURAL_OR_CELLULOSIC.some((c) => lower.includes(c))) return "natural";
  return "natural";
}

function badgeForKind(kind: "synthetic" | "natural"): string {
  return kind === "synthetic" ? "Synthetic" : "Natural";
}

function savedVerdictStampClass(verdict: SavedItem["verdict"]): "trap" | "win" | "think-twice" {
  if (verdict === "trap") return "trap";
  if (verdict === "think_twice") return "think-twice";
  return "win";
}

function savedVerdictLabel(verdict: SavedItem["verdict"]): string {
  if (verdict === "trap") return "Not worth it.";
  if (verdict === "think_twice") return "Think Twice.";
  return "Worth It.";
}

function formatSavedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return "";
  }
}

type SavedItemDetailModalProps = {
  item: SavedItem | null;
  open: boolean;
  onClose: () => void;
};

export function SavedItemDetailModal({ item, open, onClose }: SavedItemDetailModalProps) {
  const parsedFibers = item ? parseSavedFibers(item.fibers) : [];
  const syntheticPct = parsedFibers
    .filter((f) => fiberKind(f.fiber) === "synthetic")
    .reduce((sum, f) => sum + f.percentage, 0);
  const costPerWear = item && item.price > 0 ? item.price / DEFAULT_WEAR_COUNT : null;
  const stampClass = item ? savedVerdictStampClass(item.verdict) : "win";

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".saved-detail-modal .fiber-fill[data-width]").forEach((el) => {
        el.style.width = `${el.dataset.width}%`;
      });
    }, 100);
    return () => window.clearTimeout(t);
  }, [open, item?.id, parsedFibers.length]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!item) return null;

  return (
    <div
      className={`share-modal saved-detail-modal ${open ? "open" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div className="share-modal-inner saved-detail-modal-inner" onClick={(e) => e.stopPropagation()}>
        <button className="share-close" type="button" onClick={onClose}>
          Close
        </button>

        <div className="saved-detail-hero">
          <div className="item-swatch" aria-hidden>
            <div className="item-swatch-placeholder">
              <span className="item-swatch-monogram">B</span>
            </div>
          </div>
          <div className="saved-detail-hero-meta">
            <div className="item-brand">{item.brandName}</div>
            <div className="item-name">{item.itemName}</div>
            {item.savedAt && (
              <div className="saved-detail-date">Saved {formatSavedDate(item.savedAt)}</div>
            )}
          </div>
        </div>

        <div className={`verdict-stamp ${stampClass}`} style={{ marginTop: 20 }}>
          <div>
            <div className="verdict-eyebrow">Our Verdict</div>
            <div className="verdict-text">{savedVerdictLabel(item.verdict)}</div>
            {item.verdictReason?.trim() && (
              <p className="verdict-span-note" style={{ marginTop: 10 }}>
                {item.verdictReason}
              </p>
            )}
          </div>
        </div>

        <div className="section-eyebrow" style={{ marginTop: 24 }}>
          — The Receipt
        </div>
        <div className="receipt-card">
          <div className="receipt-row">
            <div className="receipt-key">Price paid</div>
            <div className="receipt-val">${item.price.toFixed(2)}</div>
          </div>
          <div className="receipt-row">
            <div className="receipt-key">Est. material cost</div>
            <div className="receipt-val good">~${item.estimatedMaterialCost.toFixed(2)}</div>
          </div>
          <div className="receipt-row">
            <div className="receipt-key">Markup</div>
            <div className={`receipt-val big receipt-val-markup receipt-val-markup-${stampClass}`}>
              {Math.round(item.markup).toLocaleString()}%
            </div>
          </div>
          <div className="receipt-row">
            <div className="receipt-key">% synthetic</div>
            <div className={`receipt-val ${syntheticPct > 50 ? "bad" : "good"}`}>
              {parsedFibers.length > 0 ? `${Math.round(syntheticPct)}%` : "—"}
            </div>
          </div>
          {costPerWear != null && (
            <div className="receipt-row">
              <div className="receipt-key">Cost per wear (est.)</div>
              <div className={`receipt-val ${costPerWear > 5 ? "bad" : "good"}`}>
                ${costPerWear.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div className="section-eyebrow" style={{ marginTop: 24 }}>
          — Fiber Composition
        </div>
        {parsedFibers.length === 0 ? (
          <p className="auth-legal" style={{ color: "var(--text-dim)", marginTop: 8 }}>
            Composition not available for this save.
          </p>
        ) : (
          <div className="fiber-bars">
            {parsedFibers.map((f) => {
              const kind = fiberKind(f.fiber);
              return (
                <div key={`${f.fiber}-${f.percentage}`} className="fiber-row">
                  <div className="fiber-row-label">
                    <div className="fiber-name">
                      {f.fiber} <span className={`fiber-badge ${kind}`}>{badgeForKind(kind)}</span>
                    </div>
                    <div className="fiber-pct">{Math.round(f.percentage)}%</div>
                  </div>
                  <div className="fiber-track">
                    <div className={`fiber-fill ${kind}`} data-width={f.percentage} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

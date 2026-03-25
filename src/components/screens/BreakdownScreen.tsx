"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useScanResult, getStoredScanResult, isValidScanResult, normalizeScanResult } from "@/contexts/ScanResultContext";
import { addSavedItem, removeSavedItem, setUserProfile } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { ScanAnalysis } from "@/lib/scan/types";
import type { BetterAlternativeCard, BetterAlternativesPayload } from "@/lib/better-alternatives/types";

type InfoId = "material" | "cpw" | "markup";

/** Always synthetic; never tag as natural. */
const SYNTHETIC_FIBERS = [
  "polyurethane",
  "polyester",
  "nylon",
  "polyamide",
  "elastane",
  "spandex",
  "acrylic",
  "lycra",
  "gore-tex",
  "viscose",
  "rayon"
];

function fiberKind(fiber: string): "synthetic" | "natural" {
  const lower = fiber.toLowerCase();
  return SYNTHETIC_FIBERS.some((s) => lower.includes(s)) ? "synthetic" : "natural";
}

function badgeForKind(kind: "synthetic" | "natural"): string {
  return kind === "synthetic" ? "Synthetic" : "Natural";
}

function markupToBand(markup: number): string {
  if (markup < 50) return "low";
  if (markup < 150) return "medium";
  return "high";
}

/** Map analysis verdict to stamp CSS class (trap | win | think-twice). */
function verdictToStampClass(verdict: string): "trap" | "win" | "think-twice" {
  if (verdict === "Retail Trap") return "trap";
  if (verdict === "Think Twice") return "think-twice";
  return "win";
}

/** Small copy shown under each verdict. */
function verdictSubtitle(verdict: string) {
  switch (verdict) {
    case "Worth It":
      return (
        <p className="verdict-subtitle">
          The price is fair for what you&apos;re getting — markup is in line with the materials and brand.
        </p>
      );
    case "Think Twice":
      return (
        <p className="verdict-subtitle">
          You&apos;re paying a premium here. The markup may be softened by genuine quality materials and cost per wear
          — decide if that&apos;s worth it to you.
        </p>
      );
    case "Retail Trap":
      return (
        <>
          <p className="verdict-subtitle">
            Steep markup on synthetic materials — the price is not supported by what you are getting.
          </p>
          <p className="verdict-subtitle">
            Fast fashion pricing on low-quality fibers — brand recognition is doing most of the work here.
          </p>
        </>
      );
    default:
      return null;
  }
}

/** Map analysis verdict to saved item verdict (trap | win | think_twice). */
function verdictToSavedVerdict(verdict: string): "trap" | "win" | "think_twice" {
  if (verdict === "Retail Trap") return "trap";
  if (verdict === "Think Twice") return "think_twice";
  return "win";
}

function getMaterialCostMidpoint(a: ScanAnalysis): number {
  if (typeof a.estimatedMaterialCostMin === "number" && typeof a.estimatedMaterialCostMax === "number") {
    return (a.estimatedMaterialCostMin + a.estimatedMaterialCostMax) / 2;
  }
  return a.estimatedMaterialCost ?? 0;
}

function getMarkupMidpoint(a: ScanAnalysis): number {
  if (typeof a.markupMin === "number" && typeof a.markupMax === "number") {
    return (a.markupMin + a.markupMax) / 2;
  }
  return a.markup ?? 0;
}

function betterAltBadgeLabel(badge: BetterAlternativeCard["badge"]): string {
  switch (badge) {
    case "more_natural":
      return "More natural fibers";
    case "lower_markup":
      return "Lower markup";
    case "better_cpw":
      return "Better cost per wear";
    default:
      return "";
  }
}

function BetterAltProductCard({ card }: { card: BetterAlternativeCard }) {
  const [imgErr, setImgErr] = useState(false);
  const priceStr =
    card.price > 0
      ? `$${card.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : "—";
  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      className="better-alt-card"
    >
      <div className="better-alt-card-img-wrap">
        {card.imageUrl && !imgErr ? (
          <img src={card.imageUrl} alt="" onError={() => setImgErr(true)} />
        ) : (
          <div className="better-alt-card-img-placeholder" aria-hidden />
        )}
      </div>
      <div className="better-alt-card-body">
        <div className="better-alt-card-title">{card.title}</div>
        <div className="better-alt-card-brand">{card.brand}</div>
        <div className="better-alt-card-price-row">
          <span className="better-alt-card-price">{priceStr}</span>
          <span className="better-alt-card-badge">{betterAltBadgeLabel(card.badge)}</span>
        </div>
        <div className="better-alt-card-fiber">{card.fiberSummary}</div>
      </div>
    </a>
  );
}

function analysisToSavedItem(a: ScanAnalysis) {
  const fibers = a.materials.map((m) => `${m.fiber} ${m.percentage}%`);
  const estCost = getMaterialCostMidpoint(a);
  const markup = getMarkupMidpoint(a);
  return {
    brandName: a.brand,
    itemName: a.name,
    price: a.price,
    estimatedMaterialCost: estCost,
    markup,
    markupBand: markupToBand(markup),
    fibers,
    verdict: verdictToSavedVerdict(a.verdict),
    verdictReason: a.verdictReason,
    tags: a.tags,
    isEstimated: true,
    confidenceTier: 1
  };
}

export function BreakdownScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const { result, setResult, clearResult } = useScanResult();
  const [waitingForData, setWaitingForData] = useState(true);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  const validResult = normalizeScanResult(result) ?? null;

  useEffect(() => {
    if (result === null) {
      console.log("[breakdown] effect run – result (raw)", "null");
    } else {
      const r = result as unknown as Record<string, unknown>;
      console.log(
        "[breakdown] effect run – result (raw)",
        JSON.stringify({
          keys: Object.keys(result as object),
          verdict: r.verdict,
          estimatedMaterialCost: r.estimatedMaterialCost
        })
      );
    }

    if (isValidScanResult(result)) {
      setWaitingForData(false);
      return;
    }
    if (!hasCheckedStorage) {
      setHasCheckedStorage(true);
      const storedRaw = getStoredScanResult();
      if (storedRaw === null) {
        console.log("[breakdown] stored (raw)", "null");
      } else {
        const s = storedRaw as unknown as Record<string, unknown>;
        console.log(
          "[breakdown] stored (raw)",
          JSON.stringify({ keys: Object.keys(storedRaw as object), verdict: s.verdict })
        );
      }
      const stored = normalizeScanResult(storedRaw);
      if (stored) {
        setResult(stored);
        setWaitingForData(false);
        return;
      }
    }
    const t = window.setTimeout(() => {
      setWaitingForData(false);
    }, 400);
    return () => window.clearTimeout(t);
  }, [result, hasCheckedStorage, setResult]);

  useEffect(() => {
    if (waitingForData) return;
    const current = normalizeScanResult(result) ?? normalizeScanResult(getStoredScanResult());
    if (!current) {
      console.log("[breakdown] no valid scan result, redirecting to /scan");
      router.replace("/scan");
    }
  }, [waitingForData, result, router]);

  const scan = validResult ? analysisToSavedItem(validResult) : null;
  const [infoOpen, setInfoOpen] = useState<InfoId | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [savePromptOpen, setSavePromptOpen] = useState(false);

  const user = auth?.user ?? null;
  const isConfigured = auth?.isConfigured ?? false;
  const isLoggedIn = !!user;
  const saveCount = auth?.profile?.savedCount ?? 0;
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const isSaved = !!savedItemId;
  const [toast, setToast] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isProFromProfile = auth?.profile?.isPro ?? false;
  const [isProOverride, setIsProOverride] = useState(false);
  const isPro = isProFromProfile || isProOverride;

  // When scraper (or Claude) cannot provide a price (e.g. JS-rendered + bot detection),
  // allow user to enter price manually and recompute markup / cost-per-wear client-side.
  const [manualPriceInput, setManualPriceInput] = useState("");
  const [manualPriceApplied, setManualPriceApplied] = useState<number | null>(null);
  const [imageError, setImageError] = useState(false);
  const [betterAlts, setBetterAlts] = useState<BetterAlternativesPayload | null>(null);
  const [betterAltsLoading, setBetterAltsLoading] = useState(false);

  const score = 25; // TODO: derive from analysis
  const imageUrl = result?.imageUrl ?? null;
  const showProductImage = imageUrl && !imageError;

  useEffect(() => {
    const t = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".fiber-fill[data-width]").forEach((el) => {
        el.style.width = `${el.dataset.width}%`;
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!validResult) return;
    const v = validResult.verdict;
    if (v !== "Think Twice" && v !== "Retail Trap") {
      setBetterAlts(null);
      setBetterAltsLoading(false);
      return;
    }
    let cancelled = false;
    setBetterAltsLoading(true);
    setBetterAlts(null);
    fetch("/api/better-alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan: validResult })
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("better-alternatives failed");
        return res.json() as Promise<BetterAlternativesPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setBetterAlts(data);
      })
      .catch(() => {
        if (!cancelled) {
          setBetterAlts({ sameBrand: null, sameBrandSkippedMessage: null, crossBrand: null });
        }
      })
      .finally(() => {
        if (!cancelled) setBetterAltsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [validResult]);

  const ringDashOffset = useMemo(() => {
    const circumference = 188;
    return circumference - (score / 100) * circumference;
  }, [score]);

  useEffect(() => {
    function close(e: MouseEvent) {
      const target = e.target as Node;
      if (target && document.body.contains(target) && (target as Element).closest?.(".info-wrap, .info-popover")) return;
      setInfoOpen(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function showToast() {
    setToast(true);
    window.setTimeout(() => setToast(false), 2500);
  }

  async function doSave() {
    if (!user || !isFirebaseConfigured() || !scan) return;
    setSaveError(null);
    try {
      const id = await addSavedItem(user.uid, scan);
      setSavedItemId(id);
      showToast();
      await setUserProfile(user.uid, { savedCount: (auth?.profile?.savedCount ?? 0) + 1 });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function doUnsave() {
    if (!savedItemId) return;
    setSaveError(null);
    try {
      await removeSavedItem(savedItemId);
      setSavedItemId(null);
      if (user && auth?.profile)
        await setUserProfile(user.uid, { savedCount: Math.max(0, (auth.profile.savedCount ?? 1) - 1) });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Remove failed");
    }
  }

  function toggleSave() {
    if (isSaved) doUnsave();
    else doSave();
  }

  function handleSaveTap() {
    if (!isConfigured) {
      setSavePromptOpen(true);
      return;
    }
    if (!isLoggedIn) {
      setSavePromptOpen(true);
      return;
    }
    if (!isPro && saveCount >= 2 && !isSaved) {
      setPremiumOpen(true);
      return;
    }
    toggleSave();
  }

  async function handleSavePromptGoogle() {
    if (!auth?.isConfigured) {
      setSavePromptOpen(false);
      return;
    }
    try {
      await auth.signInWithGoogle();
      setSavePromptOpen(false);
      await doSave();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Sign-in failed");
    }
  }

  async function handleSavePromptEmailSignUp(email: string, password: string) {
    if (!auth?.isConfigured) {
      setSavePromptOpen(false);
      return;
    }
    try {
      await auth.signUpWithEmail(email, password);
      setSavePromptOpen(false);
      await doSave();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Sign-up failed");
    }
  }

  if (waitingForData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-10">
        <div className="analyzing-label">Loading</div>
        <div className="analyzing-title" style={{ fontSize: 18, fontStyle: "normal" }}>
          Pulling your breakdown…
        </div>
      </div>
    );
  }

  if (!scan) return null;

  const syntheticPct = result
    ? result.materials
        .filter((m) => fiberKind(m.fiber) === "synthetic")
        .reduce((sum, m) => sum + m.percentage, 0)
    : 0;

  // Baseline values from analysis
  const basePrice = result?.price ?? 0;
  const hasAnalysisPrice = basePrice > 0;

  // Effective price: either manual override, or the analysis price if > 0, otherwise null.
  const effectivePrice: number | null =
    manualPriceApplied != null ? manualPriceApplied : hasAnalysisPrice ? basePrice : null;

  const hasCostRange =
    result &&
    typeof result.estimatedMaterialCostMin === "number" &&
    typeof result.estimatedMaterialCostMax === "number";
  const hasMarkupRange = result && typeof result.markupMin === "number" && typeof result.markupMax === "number";

  // Effective markup (range or single): when user enters price, recompute from cost range when available.
  let effectiveMarkupMin = result?.markupMin ?? 0;
  let effectiveMarkupMax = result?.markupMax ?? 0;
  let effectiveMarkup = getMarkupMidpoint(result!);
  let effectiveCostPerWear = result?.costPerWear ?? 0;
  if (result && effectivePrice != null) {
    if (hasCostRange && result.estimatedMaterialCostMax > 0 && result.estimatedMaterialCostMin > 0) {
      effectiveMarkupMin = (effectivePrice / result.estimatedMaterialCostMax - 1) * 100;
      effectiveMarkupMax = (effectivePrice / result.estimatedMaterialCostMin - 1) * 100;
      effectiveMarkup = (effectiveMarkupMin + effectiveMarkupMax) / 2;
    } else {
      const estCost = getMaterialCostMidpoint(result);
      if (estCost > 0) {
        effectiveMarkup = ((effectivePrice - estCost) / estCost) * 100;
        effectiveMarkupMin = effectiveMarkupMax = effectiveMarkup;
      }
    }
    if (result.costPerWear > 0 && basePrice > 0) {
      const wearCount = basePrice / result.costPerWear;
      effectiveCostPerWear = wearCount > 0 ? effectivePrice / wearCount : result.costPerWear;
    } else {
      const assumedWears = 50;
      effectiveCostPerWear = effectivePrice / assumedWears;
    }
  }

  const verdictForAlts = result?.verdict;
  const showBetterAlternatives =
    verdictForAlts === "Think Twice" || verdictForAlts === "Retail Trap";
  const hasBetterAlternativesSection =
    showBetterAlternatives &&
    (betterAltsLoading ||
      (betterAlts &&
        (betterAlts.sameBrand != null ||
          betterAlts.crossBrand != null ||
          (betterAlts.sameBrandSkippedMessage != null && betterAlts.sameBrandSkippedMessage.length > 0))));

  const origBrandForAlts = (result?.brand || "").trim();
  const showBetterAltFromRow =
    origBrandForAlts.length > 0 &&
    !/^unknown$/i.test(origBrandForAlts) &&
    betterAlts &&
    (betterAlts.sameBrand != null ||
      (betterAlts.sameBrandSkippedMessage != null && betterAlts.sameBrandSkippedMessage.length > 0));
  const certifications = Array.isArray(result?.certifications)
    ? result.certifications.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  const showCertifiedMaterials = Boolean(result?.hasCertifiedMaterials) && certifications.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="breakdown-header">
<button
          className="back-btn"
          type="button"
          onClick={() => {
            clearResult();
            router.push("/scan");
          }}
        >
          ← Back
        </button>
        <div className="breakdown-wordmark">
          Buffi<span>.</span>
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div className="breakdown-scroll">
        <div className="item-hero">
          <div className="item-swatch" aria-hidden>
            {showProductImage ? (
              <img
                src={imageUrl!}
                alt=""
                className="item-swatch-img"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="item-swatch-placeholder">
                <span className="item-swatch-monogram">B</span>
              </div>
            )}
          </div>
          <div>
            <div className="item-brand-row">
              <span className="item-brand">{scan.brandName}</span>
              {result!.isEthicalBrand && (
                <span className="brand-badge brand-badge-ethical">Known sustainable brand</span>
              )}
            </div>
            <div className="item-name">{scan.itemName}</div>
            <div className="item-price-row">
              <div className="item-price">
                {effectivePrice != null ? `$${effectivePrice.toFixed(2)}` : "—"}
              </div>
              <div className="item-price-label">Retail</div>
            </div>
          </div>
        </div>

        <div className="pad" style={{ paddingTop: 24 }}>
          <div className={`verdict-stamp ${verdictToStampClass(result!.verdict)}`}>
            <div>
              <div className="verdict-eyebrow">Our Verdict</div>
              <div className="verdict-text">{result!.verdict}.</div>
              <div className="verdict-subtitle-wrap">{verdictSubtitle(result!.verdict)}</div>
              {result!.verdictSpanNote && (
                <p className="verdict-span-note">{result!.verdictSpanNote}</p>
              )}
            </div>
          </div>
          {result!.valuesMatch && result!.valuesMatch.length > 0 && (
            <div className="values-badges-row" role="list">
              {result!.valuesMatch.map((entry, idx) => (
                <span
                  key={`${entry.value}-${idx}`}
                  className={`values-badge values-badge-${entry.state}`}
                  title={entry.note}
                  role="listitem"
                >
                  {entry.state === "pass" && "✓"}
                  {entry.state === "fail" && "✕"}
                  {entry.state === "unverified" && "?"}
                  <span className="values-badge-label">{entry.value}</span>
                  <span className="values-badge-note" aria-hidden>{entry.note}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pad">
          <div className="section-eyebrow">— The Receipt</div>
          <div className="receipt-card">
            <div className="receipt-row">
              <div className="receipt-key">You&apos;re paying</div>
              {effectivePrice != null ? (
                <div className="receipt-val">${effectivePrice.toFixed(2)}</div>
              ) : (
                <div className="receipt-val">
                  <input
                    className="price-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="Enter price to see full analysis"
                    value={manualPriceInput}
                    onChange={(e) => setManualPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const raw = manualPriceInput.replace(/[^0-9.]/g, "");
                        const parsed = parseFloat(raw);
                        if (!Number.isNaN(parsed) && parsed > 0) {
                          setManualPriceApplied(parsed);
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>
            {effectivePrice == null && (
              <div className="receipt-row">
                <div className="receipt-key" style={{ fontSize: 11 }}>
                  We couldn&apos;t read the price from this page — enter it manually to see your full breakdown
                </div>
              </div>
            )}

            <div className="receipt-row">
              <div className="info-wrap" onClick={(e) => e.stopPropagation()}>
                <span className="receipt-key">Est. material cost</span>
                <button
                  className={`info-btn ${infoOpen === "material" ? "active" : ""}`}
                  type="button"
                  onClick={() => setInfoOpen((cur) => (cur === "material" ? null : "material"))}
                >
                  ?
                </button>
              </div>
              <div className="receipt-val good">
                {hasCostRange
                  ? `~$${result!.estimatedMaterialCostMin.toFixed(2)} – $${result!.estimatedMaterialCostMax.toFixed(2)}`
                  : `~$${getMaterialCostMidpoint(result!).toFixed(2)}`}
              </div>
            </div>
            <div className={`info-popover ${infoOpen === "material" ? "visible" : ""}`}>
              Material cost is estimated based on fiber composition, garment construction, and current commodity
              prices. Actual costs vary by manufacturer and order volume.
            </div>

            <div className="receipt-row">
              <div className="receipt-key">
                % synthetic{result!.functionalSynthetic ? " (functional)" : ""}
              </div>
              <div
                className={`receipt-val ${result!.functionalSynthetic ? "good" : syntheticPct > 50 ? "bad" : "good"}`}
              >
                {Math.round(syntheticPct)}%
              </div>
            </div>

            <div className="receipt-row">
              <div className="info-wrap" onClick={(e) => e.stopPropagation()}>
                <span className="receipt-key">Cost per wear (est.)</span>
                <button
                  className={`info-btn ${infoOpen === "cpw" ? "active" : ""}`}
                  type="button"
                  onClick={() => setInfoOpen((cur) => (cur === "cpw" ? null : "cpw"))}
                >
                  ?
                </button>
              </div>
              <div className={`receipt-val ${effectiveCostPerWear > 5 ? "bad" : "good"}`}>
                ${effectiveCostPerWear.toFixed(2)}
              </div>
            </div>
            <div className={`info-popover ${infoOpen === "cpw" ? "visible" : ""}`}>
              {effectivePrice != null ? (
                <>
                  You&apos;d have to wear this item{" "}
                  <strong>~{Math.round(effectivePrice / Math.max(effectiveCostPerWear, 0.01))} times</strong> before
                  you reached the value of what you paid.
                </>
              ) : (
                <>Enter a price to see how many wears it takes to reach the value of what you paid.</>
              )}{" "}
              paid. The lower this number, the better the investment.
            </div>

            <div className="receipt-row">
              <div className="info-wrap" onClick={(e) => e.stopPropagation()}>
                <span className="receipt-key">Markup</span>
                <button
                  className={`info-btn ${infoOpen === "markup" ? "active" : ""}`}
                  type="button"
                  onClick={() => setInfoOpen((cur) => (cur === "markup" ? null : "markup"))}
                >
                  ?
                </button>
              </div>
              <div
                className={`receipt-val big receipt-val-markup receipt-val-markup-${verdictToStampClass(result!.verdict)}`}
              >
                {(hasMarkupRange && (effectivePrice != null || result!.price > 0))
                  ? `${Math.round(effectiveMarkupMin).toLocaleString()}% – ${Math.round(effectiveMarkupMax).toLocaleString()}%`
                  : `${Math.round(effectiveMarkup).toLocaleString()}%`}
              </div>
            </div>
            <div className={`info-popover ${infoOpen === "markup" ? "visible" : ""}`}>
              The difference between the{" "}
              <strong>
                est. material cost (
                {hasCostRange
                  ? `~$${result!.estimatedMaterialCostMin.toFixed(2)} – $${result!.estimatedMaterialCostMax.toFixed(2)}`
                  : `~$${getMaterialCostMidpoint(result!).toFixed(2)}`}
                )
              </strong>{" "}
              and what you paid{" "}
              {effectivePrice != null ? `$${effectivePrice.toFixed(2)}` : "(enter a price above to see this)"}. This is
              how much extra you&apos;re paying above what it costs to make.
            </div>
          </div>
        </div>

        <div className="section-divider" />

        <div className="pad">
          <div className="section-eyebrow">— Fiber Composition</div>
          {showCertifiedMaterials && (
            <div className="certified-materials-wrap">
              <span className="certified-materials-badge">Certified materials</span>
              <div className="certified-materials-list">{certifications.join(" · ")}</div>
            </div>
          )}
          <div className="fiber-bars">
            {result!.materials.map((f) => {
              const kind = fiberKind(f.fiber);
              return (
                <div key={f.fiber} className="fiber-row">
                  <div className="fiber-row-label">
                    <div className="fiber-name">
                      {f.fiber} <span className={`fiber-badge ${kind}`}>{badgeForKind(kind)}</span>
                    </div>
                    <div className="fiber-pct">{f.percentage}%</div>
                  </div>
                  <div className="fiber-track">
                    <div className={`fiber-fill ${kind}`} data-width={f.percentage} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="section-divider" />

        {(result!.valuesMatch?.length ?? 0) > 0 && (
          <div className="pad">
            <div className="section-eyebrow">— Values Match</div>
            <div className="values-score-display">
              <div className="score-ring">
                <svg viewBox="0 0 72 72">
                  <circle className="score-ring-track" cx="36" cy="36" r="30" />
                  <circle
                    className="score-ring-fill"
                    cx="36"
                    cy="36"
                    r="30"
                    style={{ strokeDashoffset: ringDashOffset }}
                  />
                </svg>
                <div className="score-number">{score}</div>
              </div>
              <div className="values-list">
                {result!.valuesMatch!.map((entry, idx) => (
                  <div key={`${entry.value}-${idx}`} className="value-item" title={entry.note}>
                    <div className={`value-dot ${entry.state}`} aria-hidden />
                    <span>{entry.value}</span>
                    <span className="value-item-note">{entry.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasBetterAlternativesSection && (
          <>
            <div className="section-divider" />
            <div className="pad">
              <div className="section-eyebrow">— Found something better?</div>
              <p className="better-alt-disclaimer">
                Based on fiber quality and value — not sponsored.
              </p>
              {betterAltsLoading ? (
                <div className="better-alt-skeletons" aria-hidden>
                  <div className="better-alt-skeleton-card" />
                  <div className="better-alt-skeleton-card" />
                </div>
              ) : (
                betterAlts && (
                  <>
                    {showBetterAltFromRow && (
                      <>
                        <div className="better-alt-slot-label better-alt-slot-from">
                          FROM {origBrandForAlts.toUpperCase()}
                        </div>
                        {betterAlts.sameBrand ? (
                          <BetterAltProductCard card={betterAlts.sameBrand} />
                        ) : (
                          <p className="better-alt-skip-msg">{betterAlts.sameBrandSkippedMessage}</p>
                        )}
                      </>
                    )}
                    {betterAlts.crossBrand && (
                      <>
                        <div className="better-alt-slot-label better-alt-slot-worth">WORTH CONSIDERING</div>
                        <BetterAltProductCard card={betterAlts.crossBrand} />
                      </>
                    )}
                  </>
                )
              )}
            </div>
          </>
        )}

        <div className="save-btn-row">
          {saveError && (
            <p className="auth-legal" style={{ color: "var(--red)", padding: "0 24px 8px" }}>
              {saveError}
            </p>
          )}
          <button
            className={`btn-save ${isSaved ? "saved" : ""}`}
            type="button"
            onClick={handleSaveTap}
          >
            {isSaved ? "✓ Saved" : "🔖 Save"}
          </button>
          <button className="btn-share" type="button" onClick={() => setShareOpen(true)}>
            ↑ Share
          </button>
        </div>

        <div style={{ height: 80 }} />
      </div>

      <div className={`save-toast ${toast ? "show" : ""}`}>✓ Saved to your collection</div>

      {/* Save prompt modal */}
      <div className={`share-modal ${savePromptOpen ? "open" : ""}`} onClick={() => setSavePromptOpen(false)}>
        <div className="share-modal-inner" onClick={(e) => e.stopPropagation()}>
          <div style={{ marginBottom: 16 }}>
            <div className="share-card-eyebrow" style={{ marginBottom: 10 }}>
              Save this scan
            </div>
            <div className="pw-modal-title">
              Create a free
              <br />
              account to save.
            </div>
            <div className="pw-modal-sub" style={{ marginTop: 8 }}>
              Your scans, saved. Create a free account and this item gets added to your collection instantly.
            </div>
          </div>

          <button
            className="btn-google"
            type="button"
            onClick={handleSavePromptGoogle}
          >
            <span aria-hidden>G</span>
            Continue with Google
          </button>

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <div className="auth-divider-text">or</div>
            <div className="auth-divider-line" />
          </div>

          <div className="auth-input-wrap">
            <div className="auth-input-label">Email Address</div>
            <input className="auth-input" type="email" placeholder="you@example.com" id="save-prompt-email" />
          </div>
          <div className="auth-input-wrap">
            <div className="auth-input-label">Password</div>
            <input className="auth-input" type="password" placeholder="Min 6 characters" id="save-prompt-password" />
          </div>

          <button
            className="ob-next"
            type="button"
            onClick={() => {
              const email = (document.getElementById("save-prompt-email") as HTMLInputElement)?.value?.trim();
              const password = (document.getElementById("save-prompt-password") as HTMLInputElement)?.value ?? "";
              if (email && password.length >= 6) handleSavePromptEmailSignUp(email, password);
              else setSaveError("Email and password (min 6) required");
            }}
          >
            Create account &amp; Save
          </button>

          <button className="share-close" type="button" onClick={() => setSavePromptOpen(false)} style={{ marginTop: 4 }}>
            Not now
          </button>
        </div>
      </div>

      {/* Premium modal */}
      <div className={`premium-modal ${premiumOpen ? "open" : ""}`} onClick={() => setPremiumOpen(false)}>
        <div className="premium-modal-inner" onClick={(e) => e.stopPropagation()}>
          <div className="premium-eyebrow">Buffi Pro</div>
          <div className="premium-title">
            The full
            <br />
            <em>picture.</em>
          </div>
          <div className="premium-subtitle">
            Unlock everything Buffi has to offer — unlimited saves, deep analytics, and real-time price comparisons.
          </div>

          <button
            className="ob-next"
            type="button"
            style={{ width: "100%" }}
            onClick={() => {
              setIsProOverride(true);
              setPremiumOpen(false);
              showToast();
            }}
          >
            Start Pro — $30 / year
          </button>
          <button className="share-close" type="button" onClick={() => setPremiumOpen(false)} style={{ marginTop: 8 }}>
            Maybe later
          </button>
        </div>
      </div>

      {/* Share modal */}
      <div className={`share-modal ${shareOpen ? "open" : ""}`} onClick={() => setShareOpen(false)}>
        <div className="share-modal-inner" onClick={(e) => e.stopPropagation()}>
          <div
            className={`share-card-preview share-card-preview--${verdictToStampClass(result!.verdict)}`}
          >
            <div className="share-card-eyebrow">buffi · receipt</div>
            <div className="share-card-headline">
              {result!.verdict}.
              <br />
              {Math.round(getMarkupMidpoint(result!)).toLocaleString()}% markup.
            </div>
            <div className="share-stats">
              <div className="share-stat">
                <div className="share-stat-val">${result!.price}</div>
                <div className="share-stat-key">Retail</div>
              </div>
              <div className="share-stat">
                <div className="share-stat-val">~${getMaterialCostMidpoint(result!).toFixed(0)}</div>
                <div className="share-stat-key">Real Cost</div>
              </div>
              <div className="share-stat">
                <div className="share-stat-val">{Math.round(syntheticPct)}%</div>
                <div className="share-stat-key">Synthetic</div>
              </div>
            </div>
            <div className="share-card-brand">
              Buffi<span>.</span>
            </div>
          </div>

          <div className="share-platforms">
            <button className="share-platform-btn" type="button">
              TikTok
            </button>
            <button className="share-platform-btn" type="button">
              Instagram
            </button>
            <button className="share-platform-btn" type="button">
              Copy Link
            </button>
          </div>

          <button className="share-close" type="button" onClick={() => setShareOpen(false)}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}


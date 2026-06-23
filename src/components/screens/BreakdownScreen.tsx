"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PaywallTierList } from "@/components/paywall/PaywallTierList";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useNativePurchase } from "@/hooks/useNativePurchase";
import { useAuthOptional } from "@/contexts/AuthContext";
import { useSignIn } from "@/hooks/useSignIn";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useScanResult, getStoredScanResult, isValidScanResult, normalizeScanResult, buildScanFinalizationKey, readStoredScanFinalizationKey, setStoredScanFinalizationKey } from "@/contexts/ScanResultContext";
import { addSavedItem, addScanHistoryEntry, incrementScannedCount, removeSavedItem, setUserProfile } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { ScanAnalysis, AlternativeSuggestion } from "@/lib/scan/types";
import { MATERIALS_NOT_DETECTED_TAG } from "@/lib/scan/analyze";
import { PETROLEUM_SYNTHETIC, PREMIUM_NATURAL, STANDARD_NATURAL, PREMIUM_CELLULOSIC, STANDARD_CELLULOSIC, DEFAULT_WEAR_COUNT } from "@/lib/scan/verdict";
import { useAppStoreRatingPrompt } from "@/hooks/useAppStoreRatingPrompt";
import { AppStoreRatingPreScreenModal } from "@/components/rating/AppStoreRatingPreScreenModal";
type InfoId = "material" | "cpw" | "markup";


function fiberKind(fiber: string): "synthetic" | "semi-synthetic" | "natural" {
  const lower = fiber.toLowerCase();
  if (PETROLEUM_SYNTHETIC.some((s) => lower.includes(s))) return "synthetic";
  if ([...PREMIUM_CELLULOSIC, ...STANDARD_CELLULOSIC].some((c) => lower.includes(c))) return "semi-synthetic";
  if ([...PREMIUM_NATURAL, ...STANDARD_NATURAL].some((n) => lower.includes(n))) return "natural";
  return "natural";
}

function badgeForKind(kind: "synthetic" | "semi-synthetic" | "natural"): string {
  if (kind === "synthetic") return "Synthetic";
  if (kind === "semi-synthetic") return "Semi-Synthetic";
  return "Natural";
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

function verdictDisplayLabel(verdict: string): string {
  switch (verdict) {
    case "Retail Trap":
      return "Not worth it.";
    case "Worth It":
      return "Worth It.";
    case "Think Twice":
      return "Think Twice.";
    default:
      return verdict.endsWith(".") ? verdict : `${verdict}.`;
  }
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
    confidenceTier: a.confidenceTier ?? 1
  };
}

function analysisToScanHistoryEntry(a: ScanAnalysis) {
  return {
    brandName: a.brand,
    itemName: a.name,
    verdict: verdictToSavedVerdict(a.verdict),
    confidenceTier: a.confidenceTier ?? 1
  };
}

export function BreakdownScreen() {
  const router = useRouter();
  const { startCheckout, checkoutError } = useStripeCheckout();
  const { startNativePurchase, purchaseError: nativePurchaseError } = useNativePurchase();
  const isNative = Capacitor.isNativePlatform();
  const auth = useAuthOptional();
  const { handleGoogle: signInWithGoogle } = useSignIn();
  const authLoading = auth?.loading ?? true;
  const isConfigured = auth?.isConfigured ?? false;
  const user = auth?.user ?? null;
  useRequireAuth("/breakdown");

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
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [savePromptOpen, setSavePromptOpen] = useState(false);

  const isLoggedIn = !!user;
  const saveCount = auth?.profile?.savedCount ?? 0;
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const isSaved = !!savedItemId;
  const [toast, setToast] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isPro = auth?.profile?.isPro ?? false;

  // When scraper (or Claude) cannot provide a price (e.g. JS-rendered + bot detection),
  // allow user to enter price manually and recompute markup / cost-per-wear client-side.
  const [manualPriceInput, setManualPriceInput] = useState("");
  const [manualPriceApplied, setManualPriceApplied] = useState<number | null>(null);
  const [imageError, setImageError] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeSuggestion[] | null>(null);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const alternativesFetched = useRef(false);
  const trapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trapRecordedForScanRef = useRef<string | null>(null);
  const savedWithinTrapWindowRef = useRef(false);
  const trapViewStartedAtRef = useRef<number | null>(null);
  const trapTimerScanKeyRef = useRef<string | null>(null);
  const refreshProfileRef = useRef(auth?.refreshProfile);
  refreshProfileRef.current = auth?.refreshProfile;
  const score = useMemo(() => {
    const entries = result?.valuesMatch;
    if (!entries || entries.length === 0) return 0;
    const passCount = entries.filter(e => e.state === "pass").length;
    return Math.round((passCount / entries.length) * 100);
  }, [result?.valuesMatch]);
  const imageUrl = result?.imageUrl ?? null;
  const showProductImage = imageUrl && !imageError;

  const hasFinalizedCurrentScan = useRef(false);
  const finalizeKey =
    user && validResult ? buildScanFinalizationKey(user.uid, validResult) : null;

  useEffect(() => {
    if (hasFinalizedCurrentScan.current) return;
    if (!isConfigured || authLoading || !user || !validResult || !finalizeKey) return;

    if (readStoredScanFinalizationKey() === finalizeKey) {
      hasFinalizedCurrentScan.current = true;
      return;
    }

    hasFinalizedCurrentScan.current = true;
    if (isPro) {
      void addScanHistoryEntry(user.uid, analysisToScanHistoryEntry(validResult));
      void incrementScannedCount(user.uid);
      setStoredScanFinalizationKey(finalizeKey);
      return;
    }

    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/increment-scan-count", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Could not increment scan count");
        const data = (await res.json()) as { completedScans?: number; previousCompletedScans?: number };
        const previousCompletedScans = data.previousCompletedScans ?? 0;

        await addScanHistoryEntry(user.uid, analysisToScanHistoryEntry(validResult));

        if (previousCompletedScans === 0 && scan) {
          const firstScanSavedId = await addSavedItem(user.uid, { ...scan, firstScan: true });
          await setUserProfile(user.uid, { savedCount: (auth?.profile?.savedCount ?? 0) + 1 });
          setSavedItemId(firstScanSavedId);
        }

        setStoredScanFinalizationKey(finalizeKey);
        await auth?.refreshProfile();
      } catch (e) {
        hasFinalizedCurrentScan.current = false;
        setSaveError(e instanceof Error ? e.message : "Could not finalize scan");
      }
    })();
  }, [
    isConfigured,
    authLoading,
    user,
    validResult,
    finalizeKey,
    isPro,
    scan,
    auth
  ]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".fiber-fill[data-width]").forEach((el) => {
        el.style.width = `${el.dataset.width}%`;
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (alternativesFetched.current || !user || !validResult) return;
    if (validResult.verdict !== "Think Twice" && validResult.verdict !== "Retail Trap") return;
    alternativesFetched.current = true;
    setAlternativesLoading(true);
    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/alternatives", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            brand: validResult.brand,
            name: validResult.name,
            price: validResult.price,
            verdict: validResult.verdict,
            materials: validResult.materials,
            markupMin: validResult.markupMin,
            markupMax: validResult.markupMax,
            tags: validResult.tags,
            ...(validResult.garmentCategory && { garmentCategory: validResult.garmentCategory })
          })
        });
        if (res.ok) {
          const data = (await res.json()) as AlternativeSuggestion[];
          if (Array.isArray(data) && data.length > 0) setAlternatives(data);
        }
      } catch {
        // alternatives are an enhancement — fail silently
      } finally {
        setAlternativesLoading(false);
      }
    })();
  }, [user, validResult]);

  useEffect(() => {
    if (isSaved) savedWithinTrapWindowRef.current = true;
  }, [isSaved]);

  useEffect(() => {
    const TRAP_WINDOW_MS = 14_000;

    const tryRecordTrapAvoided = async (scanKey: string, price: number) => {
      if (!user || savedWithinTrapWindowRef.current) return;
      if (trapRecordedForScanRef.current === scanKey) return;

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/record-trap-avoided", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ price })
        });
        if (res.ok) {
          trapRecordedForScanRef.current = scanKey;
          console.log("[breakdown] trap avoided recorded", { price });
          await refreshProfileRef.current?.();
          return;
        }
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        console.warn("[breakdown] trap avoided not recorded", res.status, errBody.error ?? res.statusText);
      } catch (err) {
        console.warn("[breakdown] trap avoided request failed", err);
      }
    };

    if (authLoading || !user || !isPro || !validResult || validResult.verdict !== "Retail Trap") {
      if (trapTimerRef.current) {
        clearTimeout(trapTimerRef.current);
        trapTimerRef.current = null;
      }
      trapTimerScanKeyRef.current = null;
      trapViewStartedAtRef.current = null;
      return;
    }

    const scanKey = `${validResult.brand}|${validResult.name}|${validResult.price}|${manualPriceApplied ?? ""}`;
    const price =
      manualPriceApplied != null && manualPriceApplied > 0
        ? manualPriceApplied
        : validResult.price > 0
          ? validResult.price
          : null;

    if (price == null) {
      console.log("[breakdown] trap avoided skipped — no price on scan");
      return;
    }

    const scheduleTrapRecord = (delayMs: number) => {
      if (trapTimerRef.current) {
        clearTimeout(trapTimerRef.current);
      }
      trapTimerRef.current = setTimeout(() => {
        trapTimerRef.current = null;
        void tryRecordTrapAvoided(scanKey, price);
      }, delayMs);
    };

    if (trapTimerScanKeyRef.current !== scanKey) {
      savedWithinTrapWindowRef.current = false;
      trapTimerScanKeyRef.current = scanKey;
      trapViewStartedAtRef.current = Date.now();
      console.log("[breakdown] trap avoided timer started (14s, do not save)");
      scheduleTrapRecord(TRAP_WINDOW_MS);
    } else if (trapTimerRef.current == null) {
      const startedAt = trapViewStartedAtRef.current ?? Date.now();
      const elapsed = Date.now() - startedAt;
      if (elapsed >= TRAP_WINDOW_MS) {
        void tryRecordTrapAvoided(scanKey, price);
      } else {
        scheduleTrapRecord(TRAP_WINDOW_MS - elapsed);
      }
    }

    return () => {
      const startedAt = trapViewStartedAtRef.current;
      const elapsed = startedAt != null ? Date.now() - startedAt : 0;
      if (trapTimerRef.current) {
        clearTimeout(trapTimerRef.current);
        trapTimerRef.current = null;
      }
      if (elapsed >= TRAP_WINDOW_MS && trapTimerScanKeyRef.current === scanKey) {
        void tryRecordTrapAvoided(scanKey, price);
      }
    };
  }, [
    authLoading,
    user,
    isPro,
    validResult?.brand,
    validResult?.name,
    validResult?.verdict,
    validResult?.price,
    manualPriceApplied
  ]);

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

  function buildShareText() {
    const verdict = result ? verdictDisplayLabel(result.verdict) : "";
    const markup = result ? Math.round(getMarkupMidpoint(result)) : 0;
    const brand = scan?.brandName ?? "";
    const name = scan?.itemName ?? "";
    const cost = result ? getMaterialCostMidpoint(result).toFixed(0) : "0";
    return `${brand} ${name}\n${verdict} ${markup}% markup · ~$${cost} real cost\n\nbuffi.app`;
  }

  async function handleSharePlatform() {
    const text = buildShareText();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Buffi Receipt", text });
      } catch {
        // user cancelled or share failed — ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setCopyLinkDone(true);
        window.setTimeout(() => setCopyLinkDone(false), 2000);
      } catch {
        // clipboard not available
      }
    }
  }

  async function handleCopyLink() {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyLinkDone(true);
      window.setTimeout(() => setCopyLinkDone(false), 2000);
    } catch {
      // clipboard not available
    }
  }

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
      await auth?.refreshProfile();
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
      await auth?.refreshProfile();
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
    toggleSave();
  }

  async function handleSavePromptGoogle() {
    if (!auth?.isConfigured) {
      setSavePromptOpen(false);
      return;
    }
    try {
      await signInWithGoogle();
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

  const breakdownReady = !waitingForData && !!validResult && !!user;
  const { preScreenOpen, closePreScreen } = useAppStoreRatingPrompt({
    uid: user?.uid,
    profile: auth?.profile,
    validResult,
    breakdownReady
  });

  if (isConfigured && authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-10">
        <div className="analyzing-label">Loading</div>
        <p className="auth-legal" style={{ color: "var(--text-dim)" }}>
          Checking your account…
        </p>
      </div>
    );
  }

  if (isConfigured && !user) {
    return null;
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
  /** Petroleum % shown as "plastic" metric; functional synthetics are excluded from this number (composition unchanged). */
  const plasticMetricSyntheticPct = result?.functionalSynthetic === true ? 0 : syntheticPct;

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
      effectiveCostPerWear = effectivePrice / DEFAULT_WEAR_COUNT;
    }
  }

  const certifications = Array.isArray(result?.certifications)
    ? result.certifications.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  const showCertifiedMaterials = Boolean(result?.hasCertifiedMaterials) && certifications.length > 0;
  const isZaraEstimatedComposition =
    (result?.brand || "").trim().toLowerCase() === "zara" && (result?.confidenceTier ?? 0) >= 2;
  const showMaterialsNotReadFromPage =
    result?.confidenceTier === 3 && result?.tags?.includes(MATERIALS_NOT_DETECTED_TAG);
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
              <div className="verdict-text">{verdictDisplayLabel(result!.verdict)}</div>
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
                {showMaterialsNotReadFromPage ? "—" : `${Math.round(plasticMetricSyntheticPct)}%`}
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
          {isZaraEstimatedComposition && (
            <p className="better-alt-disclaimer">
              Composition estimated from product name — scan the physical tag for exact materials
            </p>
          )}
          {showCertifiedMaterials && (
            <div className="certified-materials-wrap">
              <span className="certified-materials-badge">Certified materials</span>
              <div className="certified-materials-list">{certifications.join(" · ")}</div>
            </div>
          )}
          {showMaterialsNotReadFromPage ? (
            <p className="scan-zara-tag-hint auth-legal">
              We couldn&apos;t read the materials for this product. Scan the physical tag for an accurate breakdown.
            </p>
          ) : (
            <div className="fiber-bars">
              {result!.materials.map((f) => {
                const kind = fiberKind(f.fiber);
                return (
                  <div key={f.fiber} className="fiber-row">
                    <div className="fiber-row-label">
                      <div className="fiber-name">
                        {f.fiber} <span className={`fiber-badge ${kind}`}>{badgeForKind(kind)}</span>
                      </div>
                      <div className="fiber-pct">
                        {f.percentage}%{isZaraEstimatedComposition ? " Est." : ""}
                      </div>
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


        {(alternativesLoading || (alternatives && alternatives.length > 0)) && (
          <>
            <div className="section-divider" />
            <div className="pad">
              <div className="section-eyebrow">— Consider instead</div>
              {alternativesLoading && !alternatives && (
                <p className="auth-legal" style={{ color: "var(--text-dim)", marginTop: 8 }}>
                  Finding better options…
                </p>
              )}
              {alternatives && alternatives.length > 0 && (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {alternatives.map((alt, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "1px solid var(--border-light)",
                        borderRadius: 6,
                        overflow: "hidden"
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          background: "rgba(255,255,255,0.04)",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden"
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: 32,
                            color: "var(--teal)",
                            opacity: 0.35
                          }}
                        >
                          {alt.brand.charAt(0).toUpperCase()}
                        </span>
                        {alt.imageUrl && (
                          <img
                            src={alt.imageUrl}
                            alt={alt.productName}
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover"
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                      </div>
                      <div style={{ padding: "10px 12px 14px" }}>
                        <div
                          style={{
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: 9,
                            letterSpacing: "0.08em",
                            color: "var(--teal)",
                            marginBottom: 4,
                            textTransform: "uppercase"
                          }}
                        >
                          {alt.brand}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text)",
                            lineHeight: 1.3,
                            marginBottom: 6
                          }}
                        >
                          {alt.productName}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 11,
                            color: "var(--text-dim)",
                            marginBottom: 1
                          }}
                        >
                          {alt.estimatedPrice}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 11,
                            color: "var(--text-dim)",
                            marginBottom: 8
                          }}
                        >
                          {alt.keyMaterial}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 11,
                            color: "var(--text-dim)",
                            fontStyle: "italic",
                            lineHeight: 1.35,
                            marginBottom: 12
                          }}
                        >
                          {alt.whyBetter}
                        </div>
                        <a
                          href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(alt.searchQuery)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 12,
                            color: "var(--teal)",
                            textDecoration: "underline",
                            textUnderlineOffset: 3
                          }}
                        >
                          Search →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
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
            {isSaved ? "Unsave" : "🔖 Save"}
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
            Buffi works for you,
            <br />
            <em>not for brands.</em>
          </div>
          <div className="premium-subtitle">
            We don&apos;t take sponsored posts, brand deals, or payments from
            manufacturers. Our verdicts can&apos;t be bought. To keep it that
            way, Buffi is funded entirely by the people who use it.
          </div>
          <div className="premium-sub-line">
            Join the people who decided they deserved honest information.
          </div>

          <PaywallTierList
            variant="modal"
            onSelectPlan={(plan) => {
              setPremiumOpen(false);
              isNative ? void startNativePurchase(plan) : void startCheckout(plan);
            }}
          />
          {(isNative ? nativePurchaseError : checkoutError) && (
            <p className="auth-legal" style={{ color: "var(--red)", textAlign: "center", marginTop: 4 }}>
              {isNative ? nativePurchaseError : checkoutError}
            </p>
          )}
          <button type="button" className="share-close" onClick={() => router.push("/upgrade")} style={{ marginTop: 8 }}>
            View full upgrade page
          </button>
          <button className="share-close" type="button" onClick={() => setPremiumOpen(false)} style={{ marginTop: 4 }}>
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
              {verdictDisplayLabel(result!.verdict)}
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
                <div className="share-stat-val">{Math.round(plasticMetricSyntheticPct)}%</div>
                <div className="share-stat-key">Synthetic</div>
              </div>
            </div>
            <div className="share-card-brand">
              Buffi<span>.</span>
            </div>
          </div>

          <div className="share-platforms">
            <button className="share-platform-btn" type="button" onClick={() => void handleSharePlatform()}>
              TikTok
            </button>
            <button className="share-platform-btn" type="button" onClick={() => void handleSharePlatform()}>
              Instagram
            </button>
            <button className="share-platform-btn" type="button" onClick={() => void handleCopyLink()}>
              {copyLinkDone ? "Copied!" : "Copy Link"}
            </button>
          </div>

          <button className="share-close" type="button" onClick={() => setShareOpen(false)}>
            Dismiss
          </button>
        </div>
      </div>

      <AppStoreRatingPreScreenModal open={preScreenOpen} user={user} onClose={closePreScreen} />
    </div>
  );
}


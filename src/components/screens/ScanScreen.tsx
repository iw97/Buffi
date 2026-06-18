"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useAuthOptional } from "@/contexts/AuthContext";
import { usePendingScan, useScanError, readZaraUrlTagScanHint, setZaraUrlTagScanHint } from "@/contexts/ScanResultContext";
import { PaywallTierList } from "@/components/paywall/PaywallTierList";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useNativePurchase } from "@/hooks/useNativePurchase";
import { TagDetailsStep } from "@/components/scan/TagDetailsStep";
import { TagConfirmStep, type TagExtraction } from "@/components/scan/TagConfirmStep";
import type { GarmentCategoryId } from "@/lib/scan/garmentCategories";
import { onboardingIntroPath } from "@/lib/auth/onboardingStatus";
import { isFreeScanLimitReached } from "@/lib/scan/freeScanLimit";

const TagCameraScanner = dynamic(
  () => import("@/components/scan/TagCameraScanner").then((m) => ({ default: m.TagCameraScanner })),
  { ssr: false }
);

export function ScanScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
  const isConfigured = auth?.isConfigured ?? false;
  const authLoading = auth?.loading ?? true;
  const user = auth?.user ?? null;

  const completedScans = auth?.profile?.completedScans ?? 0;
  const isPro = auth?.profile?.isPro ?? false;

  const { setPending } = usePendingScan();
  const { lastError, setLastError } = useScanError();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { startCheckout, checkoutError } = useStripeCheckout();
  const { startNativePurchase, purchaseError: nativePurchaseError } = useNativePurchase();
  const isNative = Capacitor.isNativePlatform();
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [showZaraTagHint, setShowZaraTagHint] = useState(false);
  const [tagScannerOpen, setTagScannerOpen] = useState(false);
  const [tagStepComposition, setTagStepComposition] = useState<string | null>(null);
  const [tagExtractResult, setTagExtractResult] = useState<TagExtraction | null>(null);
  /** After a failed OCR, show the captured image plus tips and actions (never fail silently). */
  const [tagOcrFailure, setTagOcrFailure] = useState<{ previewUrl: string; hint?: string } | null>(null);
  const [tagFileReadError, setTagFileReadError] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const error = lastError;

  useEffect(() => {
    if (readZaraUrlTagScanHint()) {
      setShowZaraTagHint(true);
      setUrlOpen(true);
    }
  }, []);

  function clearError() {
    setLastError(null);
  }

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

  function isPaywallBlocking(): boolean {
    return isFreeScanLimitReached(completedScans, isPro);
  }

  function handleUrlSubmit() {
    const url = urlValue.trim();
    if (!url) return;
    if (isPaywallBlocking()) {
      setPaywallOpen(true);
      return;
    }
    clearError();
    setZaraUrlTagScanHint(false);
    setShowZaraTagHint(false);
    setPending({ url });
    router.push("/analyzing");
  }

  function tagImagePreviewUrl(base64Image: string): string {
    const t = base64Image.trim();
    return t.startsWith("data:") ? t : `data:image/jpeg;base64,${t}`;
  }

  function isSuccessfulTagExtraction(e: TagExtraction): boolean {
    return (
      Array.isArray(e.fibers) &&
      e.fibers.length > 0 &&
      (e.confidence === "high" || e.confidence === "medium")
    );
  }

  async function sendImageToScanTag(base64Image: string) {
    const previewUrl = tagImagePreviewUrl(base64Image);
    setTagOcrFailure(null);
    setTagFileReadError(null);
    setTagExtractResult(null);
    setOcrStatus("loading");
    try {
      if (!user) {
        setTagOcrFailure({
          previewUrl,
          hint: "Please log in to read label photos."
        });
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch("/api/scan-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: base64Image })
      });

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setTagOcrFailure({
          previewUrl,
          hint: "We could not read the server response. Check your connection and try again."
        });
        return;
      }

      if (!res.ok) {
        if (res.status === 403 && (data as { code?: string } | null)?.code === "scan_limit_reached") {
          router.push("/paywall");
          return;
        }
        setTagOcrFailure({
          previewUrl,
          hint:
            res.status === 401
              ? "Please log in again to read label photos."
              : res.status >= 500
                ? "Our label reader had a problem. Please try again in a moment."
                : "We could not process this photo. Try again or enter details manually."
        });
        return;
      }

      const errBody = data as { ok?: boolean; message?: string } | null;
      if (errBody && errBody.ok === false) {
        const msg = typeof errBody.message === "string" ? errBody.message.trim() : "";
        setTagOcrFailure({
          previewUrl,
          hint: msg || "No readable composition was found on this image."
        });
        return;
      }

      const extraction = data as TagExtraction;
      if (!isSuccessfulTagExtraction(extraction)) {
        const hint =
          extraction?.confidence === "low"
            ? "The label text was too unclear for a reliable read."
            : !extraction?.fibers?.length
              ? "We could not find a fiber composition on this label."
              : "We could not confirm the composition from this label.";
        setTagOcrFailure({ previewUrl, hint });
        return;
      }

      setTagExtractResult(extraction);
    } catch {
      setTagOcrFailure({
        previewUrl,
        hint: "We couldn't reach the server. Check your connection and try again."
      });
    } finally {
      setOcrStatus("idle");
    }
  }

  function handleTagCaptured(base64Image: string) {
    setTagScannerOpen(false);
    clearError();
    void sendImageToScanTag(base64Image);
  }

  function handleTagScannerError(message: string) {
    setTagScannerOpen(false);
    if (/denied|permission/i.test(message)) setLastError("camera_permission_denied");
    else if (/HTTPS|secure/i.test(message)) setLastError("camera_requires_https");
    else setLastError("unknown");
  }

  function handleScanTagClick() {
    if (isPaywallBlocking()) {
      setPaywallOpen(true);
      return;
    }
    clearError();
    setTagOcrFailure(null);
    setTagFileReadError(null);
    setTagScannerOpen(true);
  }

  function handleChooseFromLibrary() {
    if (isPaywallBlocking()) {
      setPaywallOpen(true);
      return;
    }
    fileInputRef.current?.click();
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1]?.trim() ?? "" : dataUrl;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleLabelFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setTagScannerOpen(false);
    setTagFileReadError(null);
    try {
      const base64 = await fileToBase64(file);
      await sendImageToScanTag(base64);
    } catch {
      setTagFileReadError("We couldn't open that photo. Try a different image.");
      setOcrStatus("idle");
    }
  }

  function handleTagConfirmBack() {
    setTagExtractResult(null);
    setTagOcrFailure(null);
  }

  function handleTagConfirmSubmit(payload: {
    composition: string;
    brand: string;
    price?: number;
    garmentCategory?: GarmentCategoryId;
  }) {
    clearError();
    setPending({
      tag: {
        composition: payload.composition,
        brand: payload.brand,
        price: payload.price,
        ...(payload.garmentCategory && { garmentCategory: payload.garmentCategory })
      }
    });
    setTagExtractResult(null);
    setTagOcrFailure(null);
    setOcrStatus("idle");
    router.push("/analyzing");
  }

  function handleTagDetailsBack() {
    setTagStepComposition(null);
    setTagOcrFailure(null);
    setOcrStatus("idle");
  }

  function handleTagDetailsSubmit(payload: {
    composition: string;
    brand?: string;
    price?: number;
    garmentCategory?: GarmentCategoryId;
  }) {
    clearError();
    setPending({ tag: payload });
    setTagStepComposition(null);
    setTagOcrFailure(null);
    setOcrStatus("idle");
    router.push("/analyzing");
  }

  if (tagExtractResult != null) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="scan-header">
          <div>
            <div className="wordmark">Buffi<span>.</span></div>
            <div className="header-tag">Material Intelligence</div>
          </div>
        </div>
        <TagConfirmStep
          extraction={tagExtractResult}
          onBack={handleTagConfirmBack}
          onSubmit={handleTagConfirmSubmit}
        />
      </div>
    );
  }

  if (tagStepComposition !== null) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="scan-header">
          <div>
            <div className="wordmark">Buffi<span>.</span></div>
            <div className="header-tag">Material Intelligence</div>
          </div>
        </div>
        <TagDetailsStep
          initialComposition={tagStepComposition}
          onBack={handleTagDetailsBack}
          onSubmit={handleTagDetailsSubmit}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="scan-header">
        <div>
          <div className="wordmark">
            Buffi<span>.</span>
          </div>
          <div className="header-tag">Material Intelligence</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isConfigured && !user ? (
            <button
              type="button"
              onClick={() =>
                router.push(onboardingIntroPath("/scan"))
              }
              style={{
                background: "none",
                border: "none",
                padding: "7px 10px",
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "var(--font-sans)",
                color: "var(--teal)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                lineHeight: 1
              }}
            >
              Log in
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/saves")}
            style={{
              background: "none",
              border: "1px solid var(--border-light)",
              padding: "7px 12px",
              cursor: "pointer",
              fontSize: 15,
              color: "var(--text-dim)",
              lineHeight: 1
            }}
            aria-label="Saved items"
          >
            🔖
          </button>
        </div>
      </div>

      <div className="scan-hero">
        <div className="scan-title-block">
          <h1>
            Know what
            <br />
            you&apos;re <em>really</em>
            <br />
            buying.
          </h1>
          <p>
            Scan any tag or paste a URL.
            <br />
            We&apos;ll show you the receipt.
          </p>
        </div>

        {error && (
          <div
            className="scan-error"
            role="alert"
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "rgba(232, 96, 74, 0.1)",
              border: "1px solid var(--red)",
              borderRadius: 4,
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              color: "var(--red)"
            }}
          >
            {error === "camera_permission_denied" && "Camera access was denied. Enable it in your browser settings."}
            {error === "camera_requires_https" && "Camera requires HTTPS. Open this page over HTTPS, or choose from photo library in the scan flow, or enter details manually."}
            {error === "product_not_found" && "Product not found in barcode database. Try pasting the product URL instead."}
            {error === "url_scrape_failed" && "Could not extract product data from that URL. Try a different product page."}
            {error === "claude_timeout" && "Analysis timed out. Please try again."}
            {error === "invalid_input" && "Invalid request. Please check your input and try again."}
            {error === "unknown" && "Something went wrong. Please try again."}
          </div>
        )}

        {tagFileReadError && (
          <div
            className="scan-error"
            role="alert"
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "rgba(232, 96, 74, 0.1)",
              border: "1px solid var(--red)",
              borderRadius: 6,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--red)"
            }}
          >
            <p style={{ margin: 0 }}>{tagFileReadError}</p>
          </div>
        )}

        {tagOcrFailure && (
          <div
            className="tag-ocr-failure-panel"
            role="alert"
            style={{
              width: "100%",
              padding: "16px 0 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14
            }}
          >
            <img
              src={tagOcrFailure.previewUrl}
              alt="Photo of the label we could not read"
              style={{
                width: "100%",
                maxWidth: 320,
                maxHeight: 220,
                objectFit: "contain",
                borderRadius: 8,
                border: "1px solid var(--border-light)",
                background: "var(--black)"
              }}
            />
            <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  lineHeight: 1.45,
                  color: "var(--text)"
                }}
              >
                We had trouble reading this label.
              </p>
              {tagOcrFailure.hint ? (
                <p
                  style={{
                    margin: "0 0 14px 0",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: "var(--text-dim)"
                  }}
                >
                  {tagOcrFailure.hint}
                </p>
              ) : null}
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12,
                  color: "var(--teal)",
                  textAlign: "center"
                }}
              >
                Try these tips:
              </p>
              <ul
                style={{
                  margin: "0 0 18px 0",
                  padding: "0 0 0 20px",
                  textAlign: "left",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--text-dim)"
                }}
              >
                <li>Flatten the label completely</li>
                <li>Make sure the text is in focus</li>
                <li>Try in brighter light</li>
              </ul>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setTagOcrFailure(null);
                    handleScanTagClick();
                  }}
                >
                  Try again
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setTagOcrFailure(null);
                    setTagStepComposition("");
                  }}
                >
                  Enter manually
                </button>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden
          onChange={handleLabelFile}
        />
        {ocrStatus === "loading" && (
          <p className="scan-ocr-status" role="status">
            Reading label…
          </p>
        )}
        {!tagOcrFailure && (
          <div
            className="viewfinder"
            onClick={ocrStatus === "loading" ? undefined : handleScanTagClick}
            role="button"
            tabIndex={ocrStatus === "loading" ? -1 : 0}
            onKeyDown={(e) => ocrStatus !== "loading" && e.key === "Enter" && handleScanTagClick()}
            aria-label="Scan clothing tag"
            style={ocrStatus === "loading" ? { pointerEvents: "none", opacity: 0.7 } : undefined}
          >
            <div className="viewfinder-inner">
              <div className="vf-corners" />
              <div className="vf-corners-b" />
              <div className="scan-line" />
              <div className="vf-icon" aria-hidden>
                🏷️
              </div>
              <div className="vf-label">Tap to Scan Tag</div>
            </div>
          </div>
        )}
        <div className="scan-actions">
          <button
            className="btn-secondary scan-btn-secondary"
            type="button"
            onClick={() => setUrlOpen((v) => !v)}
            disabled={ocrStatus === "loading"}
          >
            Paste Product URL
          </button>
          <div className={`url-input-row ${urlOpen || showZaraTagHint ? "visible" : ""}`}>
            <input
              className="url-input"
              type="url"
              placeholder="https://zara.com/product..."
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
            />
            <button className="btn-go" type="button" onClick={handleUrlSubmit} disabled={!urlValue.trim()}>
              →
            </button>
          </div>
          {showZaraTagHint && (
            <p className="scan-zara-tag-hint auth-legal">
              For Zara items, scanning the physical tag gives you the most accurate results.
            </p>
          )}
          <button
            type="button"
            className="scan-manual-link"
            onClick={() => setTagStepComposition("")}
            disabled={ocrStatus === "loading"}
          >
            Enter details manually
          </button>
        </div>
      </div>

      <TagCameraScanner
        open={tagScannerOpen}
        onCaptured={handleTagCaptured}
        onCancel={() => setTagScannerOpen(false)}
        onError={handleTagScannerError}
        onChooseFromLibrary={handleChooseFromLibrary}
      />

      {/* Paywall modal — shown before 2nd scan */}
      <div
        className={`premium-modal ${paywallOpen ? "open" : ""}`}
        onClick={() => setPaywallOpen(false)}
      >
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
              setPaywallOpen(false);
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
          <button
            className="share-close"
            type="button"
            onClick={() => setPaywallOpen(false)}
            style={{ marginTop: 4 }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

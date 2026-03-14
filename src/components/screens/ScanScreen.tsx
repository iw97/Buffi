"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { usePendingScan, useScanError } from "@/contexts/ScanResultContext";
import { TagDetailsStep } from "@/components/scan/TagDetailsStep";
import { TagConfirmStep, type TagExtraction } from "@/components/scan/TagConfirmStep";

const TagCameraScanner = dynamic(
  () => import("@/components/scan/TagCameraScanner").then((m) => ({ default: m.TagCameraScanner })),
  { ssr: false }
);

export function ScanScreen() {
  const router = useRouter();
  const { setPending } = usePendingScan();
  const { lastError, setLastError } = useScanError();
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [tagScannerOpen, setTagScannerOpen] = useState(false);
  const [tagStepComposition, setTagStepComposition] = useState<string | null>(null);
  const [tagExtractResult, setTagExtractResult] = useState<TagExtraction | null>(null);
  const [tagScanError, setTagScanError] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const error = lastError;

  function clearError() {
    setLastError(null);
  }

  function handleUrlSubmit() {
    const url = urlValue.trim();
    if (!url) return;
    clearError();
    setPending({ url });
    router.push("/analyzing");
  }

  async function sendImageToScanTag(base64Image: string) {
    setTagScanError(null);
    setTagExtractResult(null);
    setOcrStatus("loading");
    try {
      const res = await fetch("/api/scan-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image })
      });
      const data = (await res.json()) as
        | TagExtraction
        | { ok?: false; confidence: "low"; message: string };
      if (!res.ok) {
        setTagScanError("Could not read label. Try again or enter details manually.");
        return;
      }
      if ("message" in data && data.ok === false) {
        setTagScanError(data.message || "We couldn't read this label.");
        return;
      }
      const extraction = data as TagExtraction;
      if (extraction.confidence === "low" && (!extraction.fibers || extraction.fibers.length === 0)) {
        setTagScanError("We couldn't read this label — try again in better lighting or enter details manually.");
        return;
      }
      setTagExtractResult(extraction);
      setTagScanError(null);
    } catch {
      setTagScanError("We couldn't read this label — try again in better lighting or enter details manually.");
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
    clearError();
    setTagScanError(null);
    setTagScannerOpen(true);
  }

  function handleChooseFromLibrary() {
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
    try {
      const base64 = await fileToBase64(file);
      await sendImageToScanTag(base64);
    } catch {
      setTagScanError("We couldn't read this label — try again or enter details manually.");
      setOcrStatus("idle");
    }
  }

  function handleTagConfirmBack() {
    setTagExtractResult(null);
    setTagScanError(null);
  }

  function handleTagConfirmSubmit(payload: { composition: string; brand: string; price?: number }) {
    clearError();
    setPending({
      tag: {
        composition: payload.composition,
        brand: payload.brand,
        price: payload.price
      }
    });
    setTagExtractResult(null);
    setTagScanError(null);
    setOcrStatus("idle");
    router.push("/analyzing");
  }

  function handleTagDetailsBack() {
    setTagStepComposition(null);
    setOcrStatus("idle");
  }

  function handleTagDetailsSubmit(payload: { composition: string; brand?: string; price?: number }) {
    clearError();
    setPending({ tag: payload });
    setTagStepComposition(null);
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

        {tagScanError && (
          <div
            className="scan-error tag-scan-error"
            role="alert"
            style={{
              width: "100%",
              padding: "14px 18px",
              background: "rgba(232, 96, 74, 0.08)",
              border: "1px solid var(--red)",
              borderRadius: 6,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "var(--red)"
            }}
          >
            <p style={{ margin: "0 0 12px 0" }}>{tagScanError}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setTagScanError(null);
                  handleScanTagClick();
                }}
              >
                Retry
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setTagScanError(null);
                  setTagStepComposition("");
                }}
              >
                Enter details manually
              </button>
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
        <div className="scan-actions">
          <button
            className="btn-secondary scan-btn-secondary"
            type="button"
            onClick={() => setUrlOpen((v) => !v)}
            disabled={ocrStatus === "loading"}
          >
            Paste Product URL
          </button>
          <div className={`url-input-row ${urlOpen ? "visible" : ""}`}>
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
    </div>
  );
}

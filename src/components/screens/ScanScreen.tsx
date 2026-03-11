"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { usePendingScan, useScanError } from "@/contexts/ScanResultContext";
import { TagDetailsStep } from "@/components/scan/TagDetailsStep";

const BarcodeScanner = dynamic(
  () => import("@/components/scan/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner })),
  { ssr: false }
);

export function ScanScreen() {
  const router = useRouter();
  const { setPending } = usePendingScan();
  const { lastError, setLastError } = useScanError();
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [tagStepComposition, setTagStepComposition] = useState<string | null>(null);
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

  function handleBarcodeDetected(code: string) {
    setScannerOpen(false);
    clearError();
    setPending({ barcode: code });
    router.push("/analyzing");
  }

  function handleScannerError(code: "camera_permission_denied" | "unknown", _message: string) {
    setScannerOpen(false);
    setLastError(code);
  }

  function handleScanButtonClick() {
    clearError();
    setScannerOpen(true);
  }

  function handleUploadLabelClick() {
    clearError();
    fileInputRef.current?.click();
  }

  async function handleLabelFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setOcrStatus("loading");
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const worker = await Tesseract.createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      setTagStepComposition(data.text.trim() || " ");
      setOcrStatus("done");
    } catch {
      setOcrStatus("error");
      setLastError("unknown");
    }
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

        <div
          className="viewfinder"
          onClick={handleScanButtonClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleScanButtonClick()}
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
            {error === "camera_permission_denied" && "Camera access was denied. Enable it in your browser settings to scan barcodes."}
            {error === "product_not_found" && "Product not found in barcode database. Try pasting the product URL instead."}
            {error === "url_scrape_failed" && "Could not extract product data from that URL. Try a different product page."}
            {error === "claude_timeout" && "Analysis timed out. Please try again."}
            {error === "invalid_input" && "Invalid request. Please check your input and try again."}
            {error === "unknown" && "Something went wrong. Please try again."}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-hidden
          onChange={handleLabelFile}
        />
        {ocrStatus === "loading" && (
          <p className="scan-ocr-status" role="status">
            Reading label…
          </p>
        )}
        <div className="scan-actions">
          <button className="btn-primary" type="button" onClick={handleScanButtonClick} disabled={ocrStatus === "loading"}>
            ↑ Scan Clothing Tag
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={handleUploadLabelClick}
            disabled={ocrStatus === "loading"}
          >
            📷 Upload label photo
          </button>
          <button className="btn-secondary" type="button" onClick={() => setUrlOpen((v) => !v)} disabled={ocrStatus === "loading"}>
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
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onDetected={handleBarcodeDetected}
        onCancel={() => setScannerOpen(false)}
        onError={handleScannerError}
      />
    </div>
  );
}

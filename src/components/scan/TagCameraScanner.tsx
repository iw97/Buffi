"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CAPTURE_INTERVAL_MS = 2500;
const MIN_TEXT_LENGTH = 15;
const STABILITY_COUNT = 2;

const COMPOSITION_HINTS = [
  "cotton",
  "polyester",
  "wool",
  "silk",
  "linen",
  "nylon",
  "rayon",
  "viscose",
  "elastane",
  "spandex",
  "acrylic",
  "modal",
  "cashmere",
  "hemp",
  "lyocell",
  "tencel",
  "polyamide"
];

function looksLikeComposition(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < MIN_TEXT_LENGTH) return false;
  const hasFiber = COMPOSITION_HINTS.some((h) => t.includes(h));
  const hasPercent = /\d+\s*%|%\s*\d+/.test(t) || t.includes("%");
  const hasDigits = /\d+/.test(t);
  return hasFiber || (hasPercent && hasDigits);
}

function textSimilar(a: string, b: string): boolean {
  const na = a.trim().length;
  const nb = b.trim().length;
  if (na < MIN_TEXT_LENGTH || nb < MIN_TEXT_LENGTH) return false;
  const lengthRatio = Math.min(na, nb) / Math.max(na, nb);
  if (lengthRatio < 0.6) return false;
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap++;
  });
  const jaccard = overlap / (wordsA.size + wordsB.size - overlap) || 0;
  return jaccard >= 0.4 || lengthRatio >= 0.85;
}

export interface TagCameraScannerProps {
  open: boolean;
  /** Called with base64 image data (no data URL prefix) when label is captured */
  onCaptured: (base64Image: string) => void;
  onCancel: () => void;
  onError: (message: string) => void;
  /** Optional: show "Choose from photo library" and call when tapped */
  onChooseFromLibrary?: () => void;
}

export function TagCameraScanner({ open, onCaptured, onCancel, onError, onChooseFromLibrary }: TagCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastClearTextRef = useRef<string>("");
  const stableCountRef = useRef(0);
  const capturedRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "reading">("idle");

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    lastClearTextRef.current = "";
    stableCountRef.current = 0;
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    return () => stopCamera();
  }, [open, stopCamera]);

  useEffect(() => {
    if (!open) return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError(
        "Camera requires a secure connection (HTTPS). Open this page over HTTPS, or use “Upload label photo” instead."
      );
      return;
    }

    let cancelled = false;
    setStatus("starting");

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().then(() => setStatus("ready")).catch(() => setStatus("ready"));
        } else {
          setStatus("ready");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err?.message ?? String(err);
          if (
            msg.includes("Permission") ||
            msg.includes("NotAllowedError") ||
            msg.includes("permission")
          ) {
            onError("Camera access was denied");
          } else {
            onError("Could not start camera");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, onError]);

  const runOcr = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current || video.readyState < 2 || capturedRef.current)
      return;

    setStatus("reading");
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      setStatus("ready");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setStatus("ready");
      return;
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const worker = await Tesseract.createWorker("eng");
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      const text = (data.text || "").trim();
      setStatus("ready");

      if (!text || text.length < MIN_TEXT_LENGTH) return;
      if (!looksLikeComposition(text)) return;

      const last = lastClearTextRef.current;
      if (last && textSimilar(text, last)) {
        stableCountRef.current += 1;
        if (stableCountRef.current >= STABILITY_COUNT) {
          capturedRef.current = true;
          stopCamera();
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1]?.trim() ?? "" : dataUrl;
          if (base64) onCaptured(base64);
          return;
        }
      } else {
        lastClearTextRef.current = text;
        stableCountRef.current = 1;
      }
    } catch {
      setStatus("ready");
    }
  }, [onCaptured, stopCamera]);

  useEffect(() => {
    if (!open || status !== "ready") return;
    capturedRef.current = false;
    intervalRef.current = setInterval(runOcr, CAPTURE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [open, status, runOcr]);

  if (!open) return null;

  return (
    <div
      className="barcode-scanner-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "var(--black)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} width={1} height={1} />
      <div
        className="barcode-scanner-window"
        style={{
          position: "relative",
          width: 280,
          height: 200,
          border: "2px solid var(--teal)",
          borderRadius: 8,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          pointerEvents: "none"
        }}
      />
      <p
        style={{
          position: "absolute",
          top: "calc(50% - 130px)",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--text-dim)",
          textTransform: "uppercase"
        }}
      >
        {status === "reading"
          ? "Reading…"
          : "Align composition label within the frame — auto-captures when clear"}
      </p>
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12
        }}
      >
        {onChooseFromLibrary && (
          <button
            type="button"
            onClick={() => {
              capturedRef.current = true;
              stopCamera();
              onCancel();
              onChooseFromLibrary();
            }}
            className="btn-secondary"
            style={{ minWidth: 200 }}
          >
            Choose from photo library
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            capturedRef.current = true;
            stopCamera();
            onCancel();
          }}
          className="btn-secondary"
          style={{ minWidth: 160 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

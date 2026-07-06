"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TagCameraScannerProps {
  open: boolean;
  /** Called with base64 image data (no data URL prefix) when user captures */
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
  const closingRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "starting" | "ready">("idle");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      closingRef.current = false;
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

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current || video.readyState < 2 || closingRef.current) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1]?.trim() ?? "" : dataUrl;
    if (!base64) return;

    closingRef.current = true;
    stopCamera();
    onCaptured(base64);
  }, [onCaptured, stopCamera]);

  if (!open) return null;

  const canCapture = status === "ready" && streamRef.current !== null;

  return (
    <div
      className="barcode-scanner-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "var(--black)",
        boxSizing: "border-box",
        minHeight: "100dvh"
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 10,
          paddingTop: "max(env(safe-area-inset-top), 16px)",
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "transparent"
        }}
      >
        <button
          type="button"
          onClick={() => {
            closingRef.current = true;
            stopCamera();
            onCancel();
          }}
          className="btn-secondary"
          style={{
            minWidth: 88,
            padding: "8px 14px",
            fontSize: 13,
            background: "rgba(0,0,0,0.35)",
            borderColor: "rgba(255,255,255,0.35)",
            color: "var(--white)"
          }}
        >
          Cancel
        </button>
        {onChooseFromLibrary ? (
          <button
            type="button"
            onClick={() => {
              closingRef.current = true;
              stopCamera();
              onCancel();
              onChooseFromLibrary();
            }}
            className="btn-secondary"
            style={{
              minWidth: 88,
              padding: "8px 14px",
              fontSize: 13,
              background: "rgba(0,0,0,0.35)",
              borderColor: "rgba(255,255,255,0.35)",
              color: "var(--white)"
            }}
          >
            Library
          </button>
        ) : (
          <span style={{ width: 88 }} aria-hidden />
        )}
      </div>

      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0
        }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} width={1} height={1} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          paddingTop: 24,
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)",
          pointerEvents: "none"
        }}
      >
        <p
          style={{
            margin: 0,
            padding: "0 24px",
            textAlign: "center",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            lineHeight: 1.45,
            letterSpacing: "0.02em",
            color: "var(--teal)"
          }}
        >
          Flatten the label and tap when ready
        </p>
        <button
          type="button"
          aria-label="Capture label photo"
          disabled={!canCapture}
          onClick={captureFrame}
          style={{
            pointerEvents: "auto",
            width: 76,
            height: 76,
            borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.95)",
            background: "rgba(255,255,255,0.22)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            cursor: canCapture ? "pointer" : "not-allowed",
            opacity: canCapture ? 1 : 0.45,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <span
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.92)",
              display: "block"
            }}
            aria-hidden
          />
        </button>
      </div>

      {status === "starting" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 13,
            color: "var(--teal)"
          }}
        >
          Starting camera…
        </div>
      )}
    </div>
  );
}

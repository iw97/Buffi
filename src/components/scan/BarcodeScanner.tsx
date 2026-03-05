"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  open: boolean;
  onDetected: (code: string) => void;
  onCancel: () => void;
  onError: (code: "camera_permission_denied" | "unknown", message: string) => void;
}

export function BarcodeScanner({ open, onDetected, onCancel, onError }: BarcodeScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  const detectedRef = useRef(false);

  const stopScanner = useCallback(() => {
    import("@ericblade/quagga2").then(({ default: Quagga }) => {
      try {
        Quagga.stop();
      } catch {
        /* ignore */
      }
    });
    setInitialized(false);
    detectedRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }
    return () => stopScanner();
  }, [open, stopScanner]);

  const startScanner = useCallback(() => {
    if (!containerRef.current || !open) return;

    import("@ericblade/quagga2").then(({ default: Quagga }) => {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: containerRef.current!,
            constraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          },
          locator: {
            patchSize: "medium",
            halfSample: true
          },
          numOfWorkers: 2,
          decoder: {
            readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader", "code_39_reader"]
          },
          locate: true
        },
        (err: Error | null) => {
          if (err) {
            const msg = err.message || String(err);
            if (
              msg.includes("Permission") ||
              msg.includes("permission") ||
              msg.includes("NotAllowedError") ||
              msg.includes("NotReadableError")
            ) {
              onError("camera_permission_denied", "Camera access was denied");
            } else {
              onError("unknown", msg);
            }
            return;
          }
          Quagga.onDetected((result) => {
            if (detectedRef.current) return;
            const code = result?.codeResult?.code ?? null;
            if (code && typeof code === "string" && /^[\dA-Za-z-]+$/.test(code)) {
              detectedRef.current = true;
              stopScanner();
              onDetected(code);
            }
          });
          Quagga.start();
          setInitialized(true);
        }
      );
    });
  }, [open, onDetected, onError, stopScanner]);

  useEffect(() => {
    if (open && !initialized) {
      startScanner();
    }
  }, [open, initialized, startScanner]);

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
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden"
        }}
      />
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
        Align composition label within the frame
      </p>
      <button
        type="button"
        onClick={() => {
          stopScanner();
          onCancel();
        }}
        className="btn-secondary"
        style={{
          position: "absolute",
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          minWidth: 160
        }}
      >
        Cancel
      </button>
    </div>
  );
}

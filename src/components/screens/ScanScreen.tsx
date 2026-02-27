"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ScanScreen() {
  const router = useRouter();
  const [urlOpen, setUrlOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="scan-header">
        <div>
          <div className="wordmark">
            Recit<span>.</span>
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

        <div className="viewfinder" onClick={() => router.push("/analyzing")} role="button" tabIndex={0}>
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
          <button className="btn-primary" type="button" onClick={() => router.push("/analyzing")}>
            ↑ Scan Clothing Tag
          </button>
          <button className="btn-secondary" type="button" onClick={() => setUrlOpen((v) => !v)}>
            Paste Product URL
          </button>
          <div className={`url-input-row ${urlOpen ? "visible" : ""}`}>
            <input className="url-input" type="url" placeholder="https://zara.com/product..." />
            <button className="btn-go" type="button" onClick={() => router.push("/analyzing")}>
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


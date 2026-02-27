"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthOptional } from "@/contexts/AuthContext";
import { addSavedItem, removeSavedItem, setUserProfile } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/client";

type InfoId = "material" | "cpw" | "markup";

/** Current scan payload (matches SavedItem shape for this screen) */
const CURRENT_SCAN = {
  brand: "Zara · W/2024",
  name: "Flowy Satin-Finish Blouse",
  retailPrice: 89,
  verdict: "trap" as const,
  tags: [
    { label: "Retail Trap", type: "trap" as const },
    { label: "100% Plastic", type: "trap" as const }
  ],
  emoji: "👚"
};

export function BreakdownScreen() {
  const router = useRouter();
  const auth = useAuthOptional();
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
  const isPro = false; // TODO: from profile or subscription

  const score = 25;

  useEffect(() => {
    const t = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".fiber-fill[data-width]").forEach((el) => {
        el.style.width = `${el.dataset.width}%`;
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, []);

  const ringDashOffset = useMemo(() => {
    const circumference = 188;
    return circumference - (score / 100) * circumference;
  }, [score]);

  useEffect(() => {
    const close = () => setInfoOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function showToast() {
    setToast(true);
    window.setTimeout(() => setToast(false), 2500);
  }

  async function doSave() {
    if (!user || !isFirebaseConfigured()) return;
    setSaveError(null);
    try {
      const id = await addSavedItem(user.uid, CURRENT_SCAN);
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

  return (
    <div className="min-h-screen flex flex-col">
      <div className="breakdown-header">
        <button className="back-btn" type="button" onClick={() => router.push("/scan")}>
          ← Back
        </button>
        <div className="breakdown-wordmark">
          Recit<span>.</span>
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div className="breakdown-scroll">
        <div className="item-hero">
          <div className="item-swatch" aria-hidden>
            👚
          </div>
          <div>
            <div className="item-brand">Zara · W/2024</div>
            <div className="item-name">Flowy Satin-Finish Blouse</div>
            <div className="item-price-row">
              <div className="item-price">$89</div>
              <div className="item-price-label">Retail</div>
            </div>
          </div>
        </div>

        <div className="pad" style={{ paddingTop: 24 }}>
          <div className="verdict-stamp trap">
            <div>
              <div className="verdict-eyebrow">Our Verdict</div>
              <div className="verdict-text">Retail Trap.</div>
            </div>
          </div>
        </div>

        <div className="pad">
          <div className="section-eyebrow">— The Receipt</div>
          <div className="receipt-card">
            <div className="receipt-row">
              <div className="receipt-key">You&apos;re paying</div>
              <div className="receipt-val">$89.00</div>
            </div>

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
              <div className="receipt-val good">~$4.20</div>
            </div>
            <div className={`info-popover ${infoOpen === "material" ? "visible" : ""}`}>
              How much it costs to <strong>actually make</strong> this item — fabric, thread, labour. Everything
              before brand markup, shipping, and retail margin.
            </div>

            <div className="receipt-row">
              <div className="receipt-key">% synthetic (plastic)</div>
              <div className="receipt-val bad">100%</div>
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
              <div className="receipt-val bad">$4.45</div>
            </div>
            <div className={`info-popover ${infoOpen === "cpw" ? "visible" : ""}`}>
              You&apos;d have to wear this item <strong>~20 times</strong> before you reached the value of what you
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
              <div className="receipt-val big">2,019%</div>
            </div>
            <div className={`info-popover ${infoOpen === "markup" ? "visible" : ""}`}>
              The difference between the <strong>est. material cost (~$4.20)</strong> and what you paid ($89.00). This
              is how much extra you&apos;re paying above what it costs to make.
            </div>
          </div>
        </div>

        <div className="section-divider" />

        <div className="pad">
          <div className="section-eyebrow">— Fiber Composition</div>
          <div className="fiber-bars">
            {[
              { name: "Polyester", badge: "Plastic", pct: 78, kind: "plastic" },
              { name: "Viscose", badge: "Synthetic", pct: 14, kind: "plastic" },
              { name: "Elastane", badge: "Plastic", pct: 8, kind: "plastic" }
            ].map((f) => (
              <div key={f.name} className="fiber-row">
                <div className="fiber-row-label">
                  <div className="fiber-name">
                    {f.name} <span className={`fiber-badge ${f.kind}`}>{f.badge}</span>
                  </div>
                  <div className="fiber-pct">{f.pct}%</div>
                </div>
                <div className="fiber-track">
                  <div className={`fiber-fill ${f.kind}`} data-width={f.pct} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-divider" />

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
              <div className="value-item">
                <div className="value-dot fail" />
                <span>Natural fibers preferred</span>
              </div>
              <div className="value-item">
                <div className="value-dot fail" />
                <span>No virgin plastic</span>
              </div>
              <div className="value-item">
                <div className="value-dot pass" />
                <span>Under $100 retail</span>
              </div>
              <div className="value-item">
                <div className="value-dot fail" />
                <span>Capsule wardrobe quality</span>
              </div>
            </div>
          </div>
        </div>

        <div className="section-divider" />

        <div className="pad">
          <div className="section-eyebrow">— Find It Secondhand Instead</div>
          {[
            { platform: "ThredUp", price: "$12", savings: "Save $77 · 86% less" },
            { platform: "Depop", price: "$18", savings: "Save $71 · 80% less" },
            { platform: "eBay", price: "$9", savings: "Save $80 · 90% less" }
          ].map((row) => (
            <div key={row.platform} className="secondhand-card">
              <div>
                <div className="sh-platform">{row.platform}</div>
                <div className="sh-price">{row.price}</div>
                <div className="sh-savings">{row.savings}</div>
              </div>
              <div className="sh-arrow" aria-hidden>
                →
              </div>
            </div>
          ))}
        </div>

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
          <div className="premium-eyebrow">Recit Pro</div>
          <div className="premium-title">
            The full
            <br />
            <em>picture.</em>
          </div>
          <div className="premium-subtitle">
            Unlock everything Recit has to offer — unlimited saves, deep analytics, and real-time price comparisons.
          </div>

          <button
            className="ob-next"
            type="button"
            style={{ width: "100%" }}
            onClick={() => {
              setIsPro(true);
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
          <div className="share-card-preview">
            <div className="share-card-eyebrow">recit · receipt</div>
            <div className="share-card-headline">
              Retail Trap.
              <br />
              2,019% markup.
            </div>
            <div className="share-stats">
              <div className="share-stat">
                <div className="share-stat-val">$89</div>
                <div className="share-stat-key">Retail</div>
              </div>
              <div className="share-stat">
                <div className="share-stat-val">~$4</div>
                <div className="share-stat-key">Real Cost</div>
              </div>
              <div className="share-stat">
                <div className="share-stat-val">100%</div>
                <div className="share-stat-key">Plastic</div>
              </div>
            </div>
            <div className="share-card-brand">
              Recit<span>.</span>
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


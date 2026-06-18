"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { requestAppStoreReview } from "@/lib/capacitor/requestAppStoreReview";

type Step = "ask" | "feedback" | "thanks";

type Props = {
  open: boolean;
  user: User | null;
  onClose: () => void;
};

export function AppStoreRatingPreScreenModal({ open, user, onClose }: Props) {
  const [step, setStep] = useState<Step>("ask");
  const [feedbackText, setFeedbackText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("ask");
      setFeedbackText("");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "thanks" || !open) return;
    const timer = window.setTimeout(() => onClose(), 2200);
    return () => window.clearTimeout(timer);
  }, [step, open, onClose]);

  async function handleYes() {
    onClose();
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    try {
      await requestAppStoreReview();
    } catch (err) {
      console.warn("[rating] native review request failed", err);
    }
  }

  function handleNotReally() {
    setError(null);
    setStep("feedback");
  }

  async function handleSendFeedback() {
    const text = feedbackText.trim();
    if (!text || !user) return;

    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not send feedback");
      setStep("thanks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="share-modal rating-prompt-modal open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-prompt-title"
      onClick={onClose}
    >
      <div className="share-modal-inner rating-prompt-modal-inner" onClick={(e) => e.stopPropagation()}>
        {step === "ask" && (
          <>
            <h2 id="rating-prompt-title" className="rating-prompt-headline">
              Enjoying Buffi?
            </h2>
            <p className="rating-prompt-sub">Your feedback helps us build a better app.</p>
            <div className="rating-prompt-actions">
              <button className="rating-prompt-btn-muted" type="button" onClick={handleNotReally}>
                Not really
              </button>
              <button className="rating-prompt-btn-yes" type="button" onClick={() => void handleYes()}>
                Yes, love it
              </button>
            </div>
          </>
        )}

        {step === "feedback" && (
          <>
            <p className="rating-prompt-sub" style={{ marginTop: 0 }}>
              What would make Buffi better?
            </p>
            <textarea
              className="rating-prompt-textarea"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell us what you think…"
              rows={4}
              disabled={busy}
              aria-label="Feedback"
            />
            {error && (
              <p className="delete-account-error" role="alert">
                {error}
              </p>
            )}
            <div className="rating-prompt-actions rating-prompt-actions--single">
              <button
                className="rating-prompt-btn-yes"
                type="button"
                disabled={busy || !feedbackText.trim()}
                onClick={() => void handleSendFeedback()}
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}

        {step === "thanks" && (
          <p className="rating-prompt-thanks">Thanks — we read every note.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type SubmitState = "idle" | "submitting" | "success" | "duplicate" | "error";

export default function WaitlistPage() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmedFirstName = firstName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!trimmedFirstName || !normalizedEmail) return;

    setSubmitState("submitting");
    setErrorDetail(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: trimmedFirstName,
          email: normalizedEmail
        })
      });

      const data = (await res.json()) as {
        ok?: boolean;
        duplicate?: boolean;
        error?: string;
        message?: string;
      };

      if (!res.ok || data.ok === false) {
        console.error("Waitlist API error:", res.status, data);
        setErrorDetail(
          typeof data.message === "string" ? data.message : "Something went wrong. Try again."
        );
        setSubmitState("error");
        return;
      }

      if (data.duplicate) {
        setSubmitState("duplicate");
        return;
      }

      setSubmitState("success");
      setFirstName("");
      setEmail("");
    } catch (error) {
      console.error("Failed to join waitlist:", error);
      setErrorDetail(null);
      setSubmitState("error");
    }
  }

  return (
    <div className="marketing-about-page waitlist-page">
      <h1 className="landing-section-title">Join the waitlist</h1>
      <p className="landing-sub waitlist-page-intro">
        Be first to know when Buffi opens more broadly.
      </p>

      {submitState === "success" ? (
        <p className="waitlist-success-message">You&apos;re on the list.</p>
      ) : (
        <form className="waitlist-form" onSubmit={handleSubmit}>
          <label className="waitlist-label" htmlFor="waitlist-first-name">
            First Name
          </label>
          <input
            id="waitlist-first-name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            className="waitlist-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />

          <label className="waitlist-label" htmlFor="waitlist-email">
            Email
          </label>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            autoComplete="email"
            className="waitlist-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {submitState === "duplicate" ? (
            <p className="waitlist-status-message">You&apos;re already on the list.</p>
          ) : null}
          {submitState === "error" ? (
            <p className="waitlist-status-message">
              {errorDetail ?? "Something went wrong. Try again."}
            </p>
          ) : null}

          <button type="submit" className="waitlist-submit" disabled={submitState === "submitting"}>
            {submitState === "submitting" ? "Joining..." : "Join the waitlist"}
          </button>
        </form>
      )}

      <p className="waitlist-page-back">
        <Link href="/" className="marketing-link">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}

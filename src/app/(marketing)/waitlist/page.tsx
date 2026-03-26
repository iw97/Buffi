"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";

type SubmitState = "idle" | "submitting" | "success" | "duplicate" | "error";

export default function WaitlistPage() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!firestore) {
      setSubmitState("error");
      return;
    }

    const trimmedFirstName = firstName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!trimmedFirstName || !normalizedEmail) return;

    setSubmitState("submitting");

    try {
      const waitlistRef = collection(firestore, "waitlist");
      const existingQuery = query(waitlistRef, where("email", "==", normalizedEmail), limit(1));
      const existing = await getDocs(existingQuery);

      if (!existing.empty) {
        setSubmitState("duplicate");
        return;
      }

      await addDoc(waitlistRef, {
        firstName: trimmedFirstName,
        email: normalizedEmail,
        joinedAt: serverTimestamp()
      });

      setSubmitState("success");
      setFirstName("");
      setEmail("");
    } catch (error) {
      console.error("Failed to join waitlist:", error);
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
            <p className="waitlist-status-message">Something went wrong. Try again.</p>
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

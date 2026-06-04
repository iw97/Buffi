"use client";

import {
  GoogleAuthProvider,
  OAuthProvider,
  sendSignInLinkToEmail,
  signInWithCustomToken,
  signInWithPopup,
  type User
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isDemoReviewEmail, normalizeAuthEmail } from "@/lib/auth/demoAccount";
import {
  buildEmailLinkCallbackUrl,
  persistLoginEmailForLink
} from "@/lib/auth/emailLinkCallback";
import { firebaseAuthUserMessage } from "@/lib/auth/firebaseErrorMessage";

type SignInMode = "signup" | "signin";

interface EmailLinkOptions {
  returnTo?: string;
  mode: SignInMode;
}

export type EmailLinkSubmitResult = { kind: "link-sent" } | { kind: "demo-code" };

export function useSignIn() {
  async function handleGoogle(): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Google sign-in failed"));
    }
  }

  async function handleApple(): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Apple sign-in failed"));
    }
  }

  async function handleEmailLink(
    email: string,
    options: EmailLinkOptions
  ): Promise<EmailLinkSubmitResult> {
    if (!auth) throw new Error("Auth is not initialized");
    if (typeof window === "undefined") throw new Error("Email link sign-in must run in browser");
    const trimmed = normalizeAuthEmail(email);
    if (!trimmed) throw new Error("Email is required");

    if (isDemoReviewEmail(trimmed)) {
      return { kind: "demo-code" };
    }

    const linkReturnTo =
      options.mode === "signin" ? "/scan" : options.returnTo;

    try {
      await sendSignInLinkToEmail(auth, trimmed, {
        url: buildEmailLinkCallbackUrl({
          email: trimmed,
          returnTo: linkReturnTo,
          mode: options.mode
        }),
        handleCodeInApp: true
      });
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Failed to send sign-in link"));
    }
    persistLoginEmailForLink(trimmed);
    return { kind: "link-sent" };
  }

  async function handleDemoCodeSignIn(email: string, code: string): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");

    const res = await fetch("/api/demo-sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizeAuthEmail(email), code: code.trim() })
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "invalid_credentials") {
        throw new Error("Incorrect code. Check App Review notes.");
      }
      if (body?.error === "not_configured") {
        throw new Error("Demo sign-in is not configured on this environment.");
      }
      throw new Error("Demo sign-in failed");
    }

    const data = (await res.json()) as { token?: string };
    if (!data.token) throw new Error("Demo sign-in failed");

    try {
      const result = await signInWithCustomToken(auth, data.token);
      return result.user;
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Demo sign-in failed"));
    }
  }

  return { handleGoogle, handleApple, handleEmailLink, handleDemoCodeSignIn };
}

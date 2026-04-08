"use client";

import { GoogleAuthProvider, sendSignInLinkToEmail, signInWithPopup, type User } from "firebase/auth";
import { auth, BUFFI_SIGNIN_EMAIL_KEY } from "@/lib/firebase";
import { safeReturnPath } from "@/lib/auth/returnTo";

type SignInMode = "signup" | "signin";

interface EmailLinkOptions {
  returnTo?: string;
  mode: SignInMode;
}

export function useSignIn() {
  async function handleGoogle(): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  }

  async function handleEmailLink(email: string, options: EmailLinkOptions): Promise<void> {
    if (!auth) throw new Error("Auth is not initialized");
    if (typeof window === "undefined") throw new Error("Email link sign-in must run in browser");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) throw new Error("Email is required");

    const returnTo = safeReturnPath(options.returnTo, "/scan");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("mode", options.mode);
    callback.searchParams.set("returnTo", returnTo);

    await sendSignInLinkToEmail(auth, trimmed, {
      url: callback.toString(),
      handleCodeInApp: true
    });
    window.localStorage.setItem(BUFFI_SIGNIN_EMAIL_KEY, trimmed);
  }

  return { handleGoogle, handleEmailLink };
}

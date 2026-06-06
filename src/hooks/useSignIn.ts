"use client";

import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserProfileViaApi } from "@/lib/auth/ensureUserProfileClient";
import { savePendingOnboardingForEmail } from "@/lib/auth/pendingOnboardingClient";
import { firebaseAuthUserMessage } from "@/lib/auth/firebaseErrorMessage";

export function useSignIn() {
  const router = useRouter();

  async function handleGoogle(): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await ensureUserProfileViaApi(result.user);
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
      await ensureUserProfileViaApi(result.user);
      return result.user;
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Apple sign-in failed"));
    }
  }

  async function handleEmailSignIn(email: string, password: string): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    const trimmed = email.trim();
    try {
      const result = await signInWithEmailAndPassword(auth, trimmed, password);
      await ensureUserProfileViaApi(result.user);
      return result.user;
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Sign-in failed"));
    }
  }

  async function handleEmailSignUp(
    email: string,
    password: string,
    options?: { saveOnboardingPending?: boolean }
  ): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    const trimmed = email.trim();
    try {
      if (options?.saveOnboardingPending) {
        await savePendingOnboardingForEmail(trimmed);
      }
      const result = await createUserWithEmailAndPassword(auth, trimmed, password);

      const token = await result.user.getIdToken(false);
      const res = await fetch("/api/ensure-user-profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: result.user.email ?? null,
          displayName: result.user.displayName ?? null,
          photoURL: result.user.photoURL ?? null,
          onboardingComplete: true
        })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load profile");
      }

      router.replace("/scan");
      return result.user;
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Could not create account"));
    }
  }

  async function handlePasswordReset(email: string): Promise<void> {
    if (!auth) throw new Error("Auth is not initialized");
    const trimmed = email.trim();
    try {
      await sendPasswordResetEmail(auth, trimmed);
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Could not send password reset email"));
    }
  }

  return {
    handleGoogle,
    handleApple,
    handleEmailSignIn,
    handleEmailSignUp,
    handlePasswordReset
  };
}

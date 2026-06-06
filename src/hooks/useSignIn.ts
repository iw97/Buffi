"use client";

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

  async function handleGoogle(): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user.email) {
        await savePendingOnboardingForEmail(result.user.email);
      }
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
      if (result.user.email) {
        await savePendingOnboardingForEmail(result.user.email);
      }
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
      await ensureUserProfileViaApi(result.user);
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

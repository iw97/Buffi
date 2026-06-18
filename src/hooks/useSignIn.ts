"use client";

import { useRef } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  type User
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { AppleSignIn } from "@/lib/appleSignIn";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { auth } from "@/lib/firebase";
import { ensureUserProfileViaApi } from "@/lib/auth/ensureUserProfileClient";
import { savePendingOnboardingForEmail } from "@/lib/auth/pendingOnboardingClient";
import { firebaseAuthUserMessage } from "@/lib/auth/firebaseErrorMessage";

async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashed = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

export function useSignIn() {
  const isSigningIn = useRef(false);

  async function handleGoogle(): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    if (isSigningIn.current) throw new Error("Sign-in already in progress");
    isSigningIn.current = true;
    try {
      if (Capacitor.isNativePlatform()) {
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(
          googleUser.authentication.idToken
        );
        const result = await signInWithCredential(auth, credential);
        if (result.user.email) {
          await savePendingOnboardingForEmail(result.user.email);
        }
        return result.user;
      } else {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        if (result.user.email) {
          await savePendingOnboardingForEmail(result.user.email);
        }
        return result.user;
      }
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Google sign-in failed"));
    } finally {
      isSigningIn.current = false;
    }
  }

  async function handleApple(): Promise<User> {
    if (!auth) throw new Error("Auth is not initialized");
    if (isSigningIn.current) throw new Error("Sign-in already in progress");
    isSigningIn.current = true;
    try {
      if (Capacitor.isNativePlatform()) {
        const { raw, hashed } = await generateNonce();
        const appleResult = await AppleSignIn.authorize({ nonce: hashed });
        const provider = new OAuthProvider("apple.com");
        const credential = provider.credential({
          idToken: appleResult.response.identityToken,
          rawNonce: raw,
        });
        const result = await signInWithCredential(auth, credential);
        if (result.user.email) {
          await savePendingOnboardingForEmail(result.user.email);
        }
        return result.user;
      } else {
        const provider = new OAuthProvider("apple.com");
        provider.addScope("email");
        provider.addScope("name");
        const result = await signInWithPopup(auth, provider);
        if (result.user.email) {
          await savePendingOnboardingForEmail(result.user.email);
        }
        return result.user;
      }
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Apple sign-in failed"));
    } finally {
      isSigningIn.current = false;
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

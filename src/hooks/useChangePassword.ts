"use client";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { firebaseAuthUserMessage } from "@/lib/auth/firebaseErrorMessage";

export function useChangePassword() {
  async function changePassword(
    user: User,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    if (!auth) throw new Error("Auth is not initialized");
    const email = user.email?.trim();
    if (!email) throw new Error("Your account has no email address");

    try {
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (e) {
      throw new Error(firebaseAuthUserMessage(e, "Could not change password"));
    }
  }

  return { changePassword };
}

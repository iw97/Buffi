function authErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** User-facing copy for common Firebase Auth failures (magic link, popup, etc.). */
export function firebaseAuthUserMessage(error: unknown, fallback: string): string {
  const code = authErrorCode(error);
  if (code) {
    switch (code) {
      case "auth/unauthorized-continue-uri":
        return "Sign-in link URL is not allowed. In Firebase Console → Authentication → Settings → Authorized domains, add this site’s domain (and your Vercel preview domain if you test previews).";
      case "auth/operation-not-allowed":
        return "Email link sign-in is turned off. Enable Email/Password (and email link if shown) in Firebase Console → Authentication → Sign-in method.";
      case "auth/invalid-email":
        return "That email address doesn’t look valid.";
      case "auth/missing-email":
        return "Enter your email address.";
      default:
        break;
    }
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

import type { User } from "firebase/auth";
import type { UserProfile } from "@/lib/firebase/types";
import { firebaseAuthUserMessage } from "@/lib/auth/firebaseErrorMessage";

type EnsureUserProfileResponse = {
  ok?: boolean;
  profile?: UserProfile | null;
  error?: string;
};

/**
 * Prefer a cached ID token after sign-in; force-refresh only if needed.
 * Force refresh calls securetoken.googleapis.com and fails when the API key
 * lacks Token Service API in its Google Cloud restrictions.
 */
async function getAuthIdToken(user: User): Promise<string> {
  try {
    return await user.getIdToken(false);
  } catch (first) {
    try {
      return await user.getIdToken(true);
    } catch (second) {
      throw new Error(firebaseAuthUserMessage(second ?? first, "Could not get sign-in token"));
    }
  }
}

/**
 * Ensure users/{uid} via Admin SDK API (only server writes on login).
 */
export async function ensureUserProfileViaApi(user: User): Promise<UserProfile> {
  console.log("[auth] auth uid:", user.uid);
  console.log("[auth] creating doc at:", `users/${user.uid}`);

  const token = await getAuthIdToken(user);
  const res = await fetch("/api/ensure-user-profile", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null
    })
  });

  const data = (await res.json().catch(() => null)) as EnsureUserProfileResponse | null;

  if (!res.ok) {
    throw new Error(data?.error ?? "Failed to load profile");
  }

  if (!data?.profile) {
    throw new Error("Profile document could not be created");
  }

  return data.profile as UserProfile;
}

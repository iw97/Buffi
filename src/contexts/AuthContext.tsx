"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut
} from "firebase/auth";
import {
  auth,
  firebaseAuthReady,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { ensureUserProfileViaApi } from "@/lib/auth/ensureUserProfileClient";
import type { UserProfile } from "@/lib/firebase/types";

async function loadProfileFromServer(firebaseUser: User): Promise<{
  profile: UserProfile | null;
  profileReady: boolean;
  profileError: string | null;
  profileLoading: boolean;
}> {
  try {
    const profile = await ensureUserProfileViaApi(firebaseUser);
    return {
      profile,
      profileReady: true,
      profileError: null,
      profileLoading: false
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load your profile";
    console.error("[auth] ensure-user-profile failed:", message);
    return {
      profile: null,
      profileReady: true,
      profileError: message,
      profileLoading: false
    };
  }
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileReady: boolean;
  profileError: string | null;
  loading: boolean;
  isConfigured: boolean;
}

interface AuthActions {
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState & AuthActions | null>(null);

const TESTING_FORCE_LOGGED_IN = false;

const MOCK_USER = {
  uid: "testing-uid",
  displayName: "Test User",
  email: "test@buffi.app",
  photoURL: null as string | null,
  metadata: { creationTime: new Date().toISOString() }
} as unknown as User;

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(TESTING_FORCE_LOGGED_IN ? MOCK_USER : null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!TESTING_FORCE_LOGGED_IN);
  const isConfigured = isFirebaseConfigured();

  const applyProfileLoad = useCallback(
    (result: Awaited<ReturnType<typeof loadProfileFromServer>>) => {
      setProfile(result.profile);
      setProfileReady(result.profileReady);
      setProfileError(result.profileError);
      setProfileLoading(result.profileLoading);
    },
    []
  );

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      if (TESTING_FORCE_LOGGED_IN) setUser(MOCK_USER);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    firebaseAuthReady
      .then(() => {
        if (cancelled) return;
        if (!auth) {
          setLoading(false);
          return;
        }
        unsubscribe = onAuthStateChanged(auth, (u) => {
          if (typeof document !== "undefined") {
            if (u) {
              document.cookie = "buffi_auth=1; path=/; max-age=2592000; samesite=lax";
            } else {
              document.cookie = "buffi_auth=; path=/; max-age=0; samesite=lax";
            }
          }
          setUser(TESTING_FORCE_LOGGED_IN && !u ? MOCK_USER : u);
          setProfile(null);
          setProfileReady(false);
          setProfileError(null);
          setLoading(false);

          if (!u) {
            setProfileLoading(false);
            return;
          }

          setProfileLoading(true);
          void loadProfileFromServer(u).then((result) => {
            if (!cancelled) applyProfileLoad(result);
          });
        });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isConfigured, applyProfileLoad]);

  const signInWithGoogle = useCallback(async () => {
    if (!auth || !isConfigured) return;
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const profile = await ensureUserProfileViaApi(result.user);
    setProfile(profile);
    setProfileReady(true);
    setProfileError(null);
    setProfileLoading(false);
  }, [isConfigured]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!auth || !isConfigured) return;
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const profile = await ensureUserProfileViaApi(result.user);
      setProfile(profile);
      setProfileReady(true);
      setProfileError(null);
      setProfileLoading(false);
    },
    [isConfigured]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!auth || !isConfigured) return;
      const result = await signInWithEmailAndPassword(auth, email, password);
      const profile = await ensureUserProfileViaApi(result.user);
      setProfile(profile);
      setProfileReady(true);
      setProfileError(null);
      setProfileLoading(false);
    },
    [isConfigured]
  );

  const sendPasswordResetEmailAction = useCallback(
    async (email: string) => {
      if (!auth || !isConfigured) return;
      await sendPasswordResetEmail(auth, email.trim());
    },
    [isConfigured]
  );

  const signOut = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    router.replace("/signin");
  }, [router]);

  const refreshProfile = useCallback(async () => {
    const u = user;
    if (!u || !isConfigured) return;
    setProfileLoading(true);
    setProfileError(null);
    const result = await loadProfileFromServer(u);
    applyProfileLoad(result);
  }, [user, isConfigured, applyProfileLoad]);

  const value = useMemo(
    () => ({
      user,
      profile,
      profileLoading,
      profileReady,
      profileError,
      loading,
      isConfigured,
      refreshProfile,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordResetEmail: sendPasswordResetEmailAction,
      signOut
    }),
    [
      user,
      profile,
      profileLoading,
      profileReady,
      profileError,
      loading,
      isConfigured,
      refreshProfile,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordResetEmailAction,
      signOut
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within FirebaseAuthProvider");
  return ctx;
}

export function useAuthOptional() {
  return useContext(AuthContext);
}

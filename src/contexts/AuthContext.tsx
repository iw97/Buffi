"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
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
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";

const RC_API_KEY = "appl_qZUBWYrqfzOndevGmIvXQnVrsfY";

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function rcLogIn(uid: string) {
  if (!isNative()) return;
  void Purchases.logIn({ appUserID: uid }).catch((e) =>
    console.warn("[rc] logIn failed", e)
  );
}

function rcLogOut() {
  if (!isNative()) return;
  void Purchases.logOut().catch((e) =>
    console.warn("[rc] logOut failed", e)
  );
}

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
  authTransitioning: boolean;
}

interface AuthActions {
  refreshProfile: () => Promise<UserProfile | null>;
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
  const [authTransitioning, setAuthTransitioning] = useState(false);
  const isConfigured = isFirebaseConfigured();
  const profileFetchId = useRef(0);

  const applyProfileLoad = useCallback(
    (result: Awaited<ReturnType<typeof loadProfileFromServer>>) => {
      setProfile(result.profile);
      setProfileReady(result.profileReady);
      setProfileError(result.profileError);
      setProfileLoading(result.profileLoading);
    },
    []
  );

  // Configure RevenueCat once on mount (native only)
  useEffect(() => {
    if (!isNative()) return;
    try {
      void Purchases.configure({ apiKey: RC_API_KEY });
    } catch (e) {
      console.warn("[rc] configure failed", e);
    }
  }, []);

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
          console.log('[auth] state changed', u?.uid);
          setAuthTransitioning(true);
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
            setAuthTransitioning(false);
            rcLogOut();
            return;
          }

          rcLogIn(u.uid);

          setProfileLoading(true);
          const fetchId = ++profileFetchId.current;
          console.log('[auth] calling ensure-user-profile');
          void loadProfileFromServer(u).then((result) => {
            if (!cancelled && profileFetchId.current === fetchId) {
              console.log('[auth] profile returned:', JSON.stringify(result.profile));
              console.log('[auth] onboardingComplete:', result.profile?.onboardingComplete);
              applyProfileLoad(result);
              setAuthTransitioning(false);
            }
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

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    // Read from Firebase directly so this works even when called from a stale closure
    // (e.g. finishSignup in OnboardingAccountScreen captures auth before sign-in completes).
    const u = auth?.currentUser;
    if (!u || !isConfigured) return null;
    setProfileLoading(true);
    setProfileError(null);
    // Bump the version so any in-flight onAuthStateChanged fetch is discarded.
    const fetchId = ++profileFetchId.current;
    const result = await loadProfileFromServer(u);
    if (profileFetchId.current === fetchId) {
      applyProfileLoad(result);
    }
    return result.profile;
  }, [isConfigured, applyProfileLoad]);

  const value = useMemo(
    () => ({
      user,
      profile,
      profileLoading,
      profileReady,
      profileError,
      loading,
      isConfigured,
      authTransitioning,
      refreshProfile,
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
      authTransitioning,
      refreshProfile,
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

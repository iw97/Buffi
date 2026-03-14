"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink as firebaseIsSignInWithEmailLink,
  signInWithEmailLink as firebaseSignInWithEmailLink
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured, BUFFI_SIGNIN_EMAIL_KEY } from "@/lib/firebase/client";
import { setUserProfile, getUserProfile, ensureUserDocument } from "@/lib/firebase/firestore";
import type { UserProfile } from "@/lib/firebase/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
}

interface AuthActions {
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Send passwordless sign-in link to email; caller should save email to localStorage (buffiSignInEmail) and show confirmation. */
  sendSignInLinkToEmail: (email: string) => Promise<void>;
  /** Complete sign-in from email link (used on /auth/callback). Returns true on success. */
  completeSignInWithEmailLink: (email: string, linkOrFullUrl: string) => Promise<void>;
  isSignInWithEmailLink: (url: string) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState & AuthActions | null>(null);

/** For testing: when true, act as if user is always logged in (mock user when none). */
const TESTING_FORCE_LOGGED_IN = true;

const MOCK_USER = {
  uid: "testing-uid",
  displayName: "Test User",
  email: "test@buffi.app",
  photoURL: null as string | null,
  metadata: { creationTime: new Date().toISOString() }
} as unknown as User;

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(TESTING_FORCE_LOGGED_IN ? MOCK_USER : null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(!TESTING_FORCE_LOGGED_IN);
  const isConfigured = isFirebaseConfigured();

  useEffect(() => {
    if (!isConfigured || !firebaseAuth) {
      setLoading(false);
      if (TESTING_FORCE_LOGGED_IN) setUser(MOCK_USER);
      return;
    }
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(TESTING_FORCE_LOGGED_IN && !u ? MOCK_USER : u);
      setProfile(null);
      setLoading(false);
      if (u) {
        ensureUserDocument(u.uid, u.email ?? null, u.displayName ?? null, u.photoURL ?? null).catch(() => {});
      }
    });
    return () => unsub();
  }, [isConfigured]);

  useEffect(() => {
    if (!user || !isConfigured) return;
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null));
  }, [user?.uid, isConfigured]);

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseAuth || !isConfigured) return;
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
    const u = result.user;
    await setUserProfile(u.uid, {
      displayName: u.displayName ?? null,
      email: u.email ?? null,
      photoURL: u.photoURL ?? null,
      createdAt: new Date().toISOString()
    });
  }, [isConfigured]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!firebaseAuth || !isConfigured) return;
      const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const u = result.user;
      await setUserProfile(u.uid, {
        displayName: u.displayName ?? null,
        email: u.email ?? null,
        photoURL: u.photoURL ?? null,
        createdAt: new Date().toISOString()
      });
    },
    [isConfigured]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!firebaseAuth || !isConfigured) return;
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    },
    [isConfigured]
  );

  const sendSignInLinkToEmailAction = useCallback(
    async (email: string) => {
      if (!firebaseAuth || !isConfigured) return;
      const baseUrl = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || baseUrl;
      const callbackUrl = `${appUrl.replace(/\/$/, "")}/auth/callback`;
      await sendSignInLinkToEmail(firebaseAuth, email.trim(), {
        url: callbackUrl,
        handleCodeInApp: true
      });
    },
    [isConfigured]
  );

  const isSignInWithEmailLinkAction = useCallback((url: string) => {
    if (!firebaseAuth) return false;
    return firebaseIsSignInWithEmailLink(firebaseAuth, url);
  }, []);

  const completeSignInWithEmailLink = useCallback(
    async (email: string, linkOrFullUrl: string) => {
      if (!firebaseAuth || !isConfigured) return;
      await firebaseSignInWithEmailLink(firebaseAuth, email.trim(), linkOrFullUrl);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(BUFFI_SIGNIN_EMAIL_KEY);
        } catch {
          /* ignore */
        }
      }
      // ensureUserDocument is triggered by onAuthStateChanged
    },
    [isConfigured]
  );

  const signOut = useCallback(async () => {
    if (!firebaseAuth) return;
    await firebaseSignOut(firebaseAuth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isConfigured,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendSignInLinkToEmail: sendSignInLinkToEmailAction,
      completeSignInWithEmailLink,
      isSignInWithEmailLink: isSignInWithEmailLinkAction,
      signOut
    }),
    [
      user,
      profile,
      loading,
      isConfigured,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendSignInLinkToEmailAction,
      completeSignInWithEmailLink,
      isSignInWithEmailLinkAction,
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

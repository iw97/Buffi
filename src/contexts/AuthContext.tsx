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
  signOut as firebaseSignOut
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { setUserProfile, getUserProfile } from "@/lib/firebase/firestore";
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState & AuthActions | null>(null);

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isFirebaseConfigured();

  useEffect(() => {
    if (!isConfigured || !firebaseAuth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setProfile(null);
      setLoading(false);
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

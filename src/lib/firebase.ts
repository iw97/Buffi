import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain
  );
}

/**
 * Single Firebase app instance for the client bundle.
 * getApps().length avoids double initializeApp across Fast Refresh / duplicate imports in Next.js.
 */
function getOrCreateApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

const app = getOrCreateApp();

export default app;
export const auth: Auth | null = app ? getAuth(app) : null;
export const firestore: Firestore | null = app ? getFirestore(app) : null;

/**
 * Run on client before relying on persisted sessions (e.g. Netlify previews).
 */
export const firebaseAuthReady =
  auth && typeof window !== "undefined"
    ? setPersistence(auth, browserLocalPersistence).catch((e) => {
        console.warn("[firebase] failed to set browserLocalPersistence:", e);
      })
    : Promise.resolve();

/** localStorage key for email when completing email-link sign-in (e.g. from another device). */
export const BUFFI_SIGNIN_EMAIL_KEY = "buffiSignInEmail";

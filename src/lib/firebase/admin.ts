/**
 * Firebase Admin SDK — bypasses security rules (server / API routes only).
 * Used for internal collections such as productScans.
 *
 * Set FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON of a service account key
 * (single line or standard JSON in env — for Vercel/Netlify, paste minified JSON).
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null | undefined;

function tryInitAdmin(): App | null {
  if (adminApp !== undefined) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    adminApp = null;
    return null;
  }
  try {
    const cred = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!cred.project_id || !cred.client_email || !cred.private_key) {
      console.warn("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON missing required fields");
      adminApp = null;
      return null;
    }
    adminApp = initializeApp({
      credential: cert({
        projectId: cred.project_id,
        clientEmail: cred.client_email,
        privateKey: cred.private_key.replace(/\\n/g, "\n")
      })
    });
    return adminApp;
  } catch (e) {
    console.warn("[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", (e as Error).message);
    adminApp = null;
    return null;
  }
}

/** Firestore with admin privileges, or null if service account is not configured. */
export function getAdminFirestore(): Firestore | null {
  const app = tryInitAdmin();
  if (!app) return null;
  return getFirestore(app);
}

/** Firebase Admin Auth, or null if service account is not configured. */
export function getAdminAuth(): Auth | null {
  const app = tryInitAdmin();
  if (!app) return null;
  return getAuth(app);
}

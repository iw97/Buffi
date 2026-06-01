/**
 * Add an email to the Firestore `invites` collection (Admin SDK).
 *
 * Usage:
 *   npx tsx scripts/create-invite.ts you@example.com
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON in .env.local
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const INVITES_COLLECTION = "invites";

function initAdminFirestore() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set in .env.local");
  }

  const serviceAccount = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, "\n")
      })
    });
  }

  return getFirestore();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createInvite(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new Error(`Invalid email: ${email}`);
  }

  const db = initAdminFirestore();
  const ref = db.collection(INVITES_COLLECTION).doc(normalized);
  const existing = await ref.get();

  if (existing.exists) {
    console.log(`Invite already exists for ${normalized}`);
    console.log(JSON.stringify(existing.data(), null, 2));
    return;
  }

  await ref.set({
    email: normalized,
    active: true,
    createdAt: FieldValue.serverTimestamp()
  });

  console.log(`Invite created for ${normalized}`);
  console.log(`Collection: ${INVITES_COLLECTION}`);
  console.log(`Document ID: ${normalized}`);
}

async function main(): Promise<void> {
  const emailArg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  if (!emailArg) {
    console.error("Usage: npx tsx scripts/create-invite.ts <email>");
    process.exit(1);
  }

  await createInvite(emailArg);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

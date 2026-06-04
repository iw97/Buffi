/**
 * Ensure the App Store review demo Firebase Auth user exists.
 *
 * Usage:
 *   npx tsx scripts/create-demo-review-account.ts
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON in .env.local
 * The account is also auto-created on first demo sign-in via /api/demo-sign-in.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { FieldValue } from "firebase-admin/firestore";
import { DEMO_REVIEW_EMAIL } from "../src/lib/auth/demoAccount";
import { getAdminAuth, getAdminFirestore } from "../src/lib/firebase/admin";

async function main(): Promise<void> {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set in .env.local");
  }

  let uid: string;
  try {
    const existing = await adminAuth.getUserByEmail(DEMO_REVIEW_EMAIL);
    uid = existing.uid;
    console.log(`Demo review user already exists: ${DEMO_REVIEW_EMAIL} (${uid})`);
  } catch {
    const created = await adminAuth.createUser({
      email: DEMO_REVIEW_EMAIL,
      emailVerified: true,
      displayName: "App Review"
    });
    uid = created.uid;
    console.log(`Created demo review user: ${DEMO_REVIEW_EMAIL} (${uid})`);
  }

  const db = getAdminFirestore();
  if (db) {
    await db.collection("users").doc(uid).set(
      {
        email: DEMO_REVIEW_EMAIL,
        displayName: "App Review",
        shopperType: "All three — I'm done settling",
        isPro: false,
        scanCount: 0,
        completedScans: 0,
        savedCount: 0,
        scannedCount: 0,
        trapsAvoided: 0,
        estimatedMoneySaved: 0,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    console.log(`Ensured Firestore profile for users/${uid}`);
  }

  console.log("\nApp Review credentials:");
  console.log(`  Email: ${DEMO_REVIEW_EMAIL}`);
  console.log("  Code:  123456");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

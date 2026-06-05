/** App Store review demo — sign in with email + password in Firebase Auth. */
export const DEMO_REVIEW_EMAIL = "review@buffi.app";
export const DEMO_REVIEW_PASSWORD = "123456";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isDemoReviewEmail(email: string): boolean {
  return normalizeAuthEmail(email) === DEMO_REVIEW_EMAIL;
}

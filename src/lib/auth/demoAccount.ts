/** App Store review demo — bypasses magic link email delivery. */
export const DEMO_REVIEW_EMAIL = "review@buffi.app";
export const DEMO_REVIEW_CODE = "123456";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isDemoReviewEmail(email: string): boolean {
  return normalizeAuthEmail(email) === DEMO_REVIEW_EMAIL;
}

export function isDemoReviewCode(code: string): boolean {
  return code.trim() === DEMO_REVIEW_CODE;
}

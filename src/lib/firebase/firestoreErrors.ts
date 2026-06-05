/** Firebase/Firestore client error code (e.g. permission-denied). */
export function getFirestoreErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function isFirestorePermissionDenied(error: unknown): boolean {
  return getFirestoreErrorCode(error) === "permission-denied";
}

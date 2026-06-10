/** Firebase/Firestore client error code (e.g. permission-denied). */
export function getFirestoreErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function isFirestorePermissionDenied(error: unknown): boolean {
  return getFirestoreErrorCode(error) === "permission-denied";
}

function firestoreErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

/** User-facing copy for saved-items list subscription failures. */
export function savedItemsListErrorMessage(error: unknown): string {
  const code = getFirestoreErrorCode(error);
  const message = firestoreErrorMessage(error);

  if (code === "failed-precondition" || message.toLowerCase().includes("requires an index")) {
    return "Your saved items are still syncing — the database index may be building. Refresh in a few minutes.";
  }
  if (isFirestorePermissionDenied(error)) {
    return "Couldn't load saved items. Sign out and sign in again, then retry.";
  }
  return message || "Couldn't load saved items. Try refreshing the page.";
}

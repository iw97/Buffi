/** Free (non-Pro) users may complete this many scans before the paywall applies. */
export const FREE_SCAN_LIMIT = 1;

export function isFreeScanLimitReached(completedScans: number, isPro: boolean): boolean {
  if (isPro) return false;
  return completedScans >= FREE_SCAN_LIMIT;
}

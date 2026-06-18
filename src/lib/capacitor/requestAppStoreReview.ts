import { Capacitor } from "@capacitor/core";

/** Native App Store / Play in-app review sheet. No-op on web. */
export async function requestAppStoreReview(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { InAppReview } = await import("@capacitor-community/in-app-review");
  await InAppReview.requestReview();
}

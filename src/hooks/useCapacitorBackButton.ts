"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/** Intercept native back so WebView history is used instead of exiting to the browser. */
export function useCapacitorBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let listener: { remove: () => Promise<void> } | null = null;

    void (async () => {
      const { App } = await import("@capacitor/app");
      if (cancelled) return;

      listener = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        }
      });
    })();

    return () => {
      cancelled = true;
      void listener?.remove();
    };
  }, []);
}

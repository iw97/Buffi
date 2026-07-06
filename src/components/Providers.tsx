"use client";

import { FirebaseAuthProvider } from "@/contexts/AuthContext";
import {
  ScanResultProvider,
  PendingScanProvider,
  ScanErrorProvider
} from "@/contexts/ScanResultContext";
import { LaunchSplashGate } from "@/components/LaunchSplashGate";
import { CapacitorBackButtonHandler } from "@/components/CapacitorBackButtonHandler";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseAuthProvider>
      <ScanResultProvider>
        <PendingScanProvider>
          <ScanErrorProvider>
            <CapacitorBackButtonHandler />
            <LaunchSplashGate>{children}</LaunchSplashGate>
          </ScanErrorProvider>
        </PendingScanProvider>
      </ScanResultProvider>
    </FirebaseAuthProvider>
  );
}

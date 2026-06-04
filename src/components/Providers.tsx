"use client";

import { FirebaseAuthProvider } from "@/contexts/AuthContext";
import {
  ScanResultProvider,
  PendingScanProvider,
  ScanErrorProvider
} from "@/contexts/ScanResultContext";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { LaunchSplashGate } from "@/components/LaunchSplashGate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseAuthProvider>
      <ScanResultProvider>
        <PendingScanProvider>
          <ScanErrorProvider>
            <ServiceWorkerRegister />
            <LaunchSplashGate>{children}</LaunchSplashGate>
          </ScanErrorProvider>
        </PendingScanProvider>
      </ScanResultProvider>
    </FirebaseAuthProvider>
  );
}

"use client";

import { FirebaseAuthProvider } from "@/contexts/AuthContext";
import {
  ScanResultProvider,
  PendingScanProvider,
  ScanErrorProvider
} from "@/contexts/ScanResultContext";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseAuthProvider>
      <ScanResultProvider>
        <PendingScanProvider>
          <ScanErrorProvider>
            <ServiceWorkerRegister />
            {children}
          </ScanErrorProvider>
        </PendingScanProvider>
      </ScanResultProvider>
    </FirebaseAuthProvider>
  );
}

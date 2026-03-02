"use client";

import { FirebaseAuthProvider } from "@/contexts/AuthContext";
import {
  ScanResultProvider,
  PendingScanProvider,
  ScanErrorProvider
} from "@/contexts/ScanResultContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseAuthProvider>
      <ScanResultProvider>
        <PendingScanProvider>
          <ScanErrorProvider>{children}</ScanErrorProvider>
        </PendingScanProvider>
      </ScanResultProvider>
    </FirebaseAuthProvider>
  );
}

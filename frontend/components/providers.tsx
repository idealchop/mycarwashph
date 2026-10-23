"use client";

import type { ReactNode } from "react";
import { AuthGateProvider } from "@/components/auth/auth-gate";
import { AuthProvider } from "@/lib/auth";
import { PwaHost } from "@/components/pwa/pwa-host";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGateProvider>{children}<PwaHost /></AuthGateProvider>
    </AuthProvider>
  );
}

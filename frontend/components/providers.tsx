"use client";

import type { ReactNode } from "react";
import { AuthGateProvider } from "@/components/auth/auth-gate";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGateProvider>{children}</AuthGateProvider>
    </AuthProvider>
  );
}

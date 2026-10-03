"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Spinner } from "./screen";

/** Client-side guard: sends signed-out users to the welcome screen. The API enforces auth server-side. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);
  if (loading || !user) return <Spinner />;
  return <>{children}</>;
}

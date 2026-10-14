import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileScreen } from "@/features/moments/profile-screen";

export const metadata: Metadata = { title: "Profile" };

export default function MomentsProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileScreen />
    </Suspense>
  );
}

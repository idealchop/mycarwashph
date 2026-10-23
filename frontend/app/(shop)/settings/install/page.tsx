import type { Metadata } from "next";
import { InstallScreen } from "@/features/install/install-screen";

export const metadata: Metadata = { title: "Install app" };

export default function InstallPage() {
  return <InstallScreen />;
}

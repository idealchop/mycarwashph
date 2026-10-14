import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service · Mycarwash.ph" };

export default function Page() {
  return <LegalPage doc={TERMS} />;
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy · Mycarwash.ph" };

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}

import { redirect } from "next/navigation";
import { CompanionScreen } from "@/features/companion/companion-screen";
import { companionEnabled } from "@/lib/companion-flag";

export default function CompanionPage() {
  if (!companionEnabled()) redirect("/home");
  return <CompanionScreen />;
}

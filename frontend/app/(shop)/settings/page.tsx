import { redirect } from "next/navigation";

/** Settings lives on Account (Barbers.ph keeps one hub). */
export default function SettingsPage() {
  redirect("/account");
}

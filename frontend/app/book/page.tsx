import type { Metadata } from "next";
import { Suspense } from "react";
import { BookScreen } from "@/features/book/book-screen";

export const metadata: Metadata = { title: "Book a car wash" };

/** Public page opened by the shop's booking QR (no sign-in). */
export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookScreen />
    </Suspense>
  );
}

import type { Metadata, Viewport } from "next";
import "@river-apps/tokens/fonts.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Mycarwash.ph",
  description: "Run your carwash from your phone: bookings, scan to verify, queue and bays.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "@river-apps/tokens/fonts.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { brand } from "@/src/config/brand";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_APP_ENV === "prod"
    ? "https://mycarwash-prod--mycarwashph.asia-southeast1.hosted.app"
    : "https://mycarwash-dev--mycarwashph.asia-southeast1.hosted.app");
const DESCRIPTION = brand.tagline;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: brand.productName, template: `%s · ${brand.productName}` },
  description: DESCRIPTION,
  applicationName: brand.productName,
  openGraph: { type: "website", siteName: brand.productName, title: brand.productName, description: DESCRIPTION, locale: "en_PH" },
  twitter: { card: "summary", title: brand.productName, description: DESCRIPTION },
  robots: process.env.NEXT_PUBLIC_APP_ENV === "prod" ? { index: true, follow: true } : { index: false, follow: false },
  formatDetection: { telephone: false },
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

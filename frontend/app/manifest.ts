import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "Mycarwash.ph",
    short_name: "Mycarwash",
    description: "Run your carwash from your phone: bookings, scan to verify, queue and bays.",
    start_url: "/home",
    display: "standalone",
    background_color: "#F2F2F4",
    theme_color: "#0A0A0A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

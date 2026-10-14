import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mycarwash.ph",
    short_name: "Mycarwash",
    description: "Run your carwash from your phone: bookings, scan to verify, queue and bays.",
    start_url: "/home",
    display: "standalone",
    background_color: "#F2F2F4",
    theme_color: "#0A0A0A",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

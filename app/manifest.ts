import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Deal Room",
    short_name: "Deal Room",
    description: "Family investment intelligence.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#f8f7f3",
    lang: "en-GB",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

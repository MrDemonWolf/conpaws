import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ConPaws Admin",
    short_name: "ConPaws",
    description: "Manage verified conventions and publish schedule updates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#091533",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Manage conventions",
        short_name: "Conventions",
        url: "/conventions",
      },
      {
        name: "Add a convention",
        short_name: "Add convention",
        url: "/conventions/new",
      },
    ],
  };
}

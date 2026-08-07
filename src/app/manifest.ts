import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hub",
    short_name: "Hub",
    description: "Project foundation",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#ff6a00",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

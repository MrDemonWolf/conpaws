import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { adminSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  // Keep Next's image optimizer endpoint disabled while 16.2.12 is pinned.
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: adminSecurityHeaders() }];
  },
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

initOpenNextCloudflareForDev();

export default nextConfig;

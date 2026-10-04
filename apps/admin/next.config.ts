import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

initOpenNextCloudflareForDev();

export default nextConfig;

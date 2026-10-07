import path from "node:path";
import { defineConfig } from "vitest/config";

process.env.TZ ??= "America/Chicago";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

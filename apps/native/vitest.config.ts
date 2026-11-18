import path from "node:path";
import { defineConfig } from "vitest/config";

process.env.TZ ??= "America/Chicago";

export default defineConfig({
  test: {
    include: ["{app,src,scripts,plugins,e2e}/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest previously ran here with no config at all, which worked only because
 * every test happened to import by relative path. The app's own code uses the
 * `@/*` alias from tsconfig, so any test touching a module that imports through
 * the alias failed to resolve. Mirroring the alias here is what lets a test
 * import the real module rather than a copy of its logic.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});

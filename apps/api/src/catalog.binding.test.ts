import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? sourceFiles(entryPath)
        : entry.name.endsWith(".ts")
          ? [entryPath]
          : [];
    }),
  );
  return nested.flat();
}

describe("catalog binding boundary", () => {
  it("keeps CATALOG_DB access in catalog.ts and the binding types only", async () => {
    const files = await sourceFiles(sourceDirectory);
    // Tests hand the binding in as a fake; production code must not reach it,
    // nor borrow the raw handle: the only exports are the two published reads.
    const forbidden = ["CATALOG_DB", "requireCatalogDatabase", ".prepare("];
    const allowed = ["catalog.ts", "bindings.ts"];
    const violations = (
      await Promise.all(
        files
          .filter(
            (file) =>
              !allowed.includes(path.basename(file)) &&
              !file.endsWith(".test.ts"),
          )
          .map(async (file) => {
            const source = await readFile(file, "utf8");
            return forbidden.some((token) => source.includes(token))
              ? file
              : null;
          }),
      )
    ).filter((file): file is string => file !== null);

    expect(violations).toEqual([]);
  });
});

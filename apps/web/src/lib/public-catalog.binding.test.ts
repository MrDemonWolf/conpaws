import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = fileURLToPath(new URL("..", import.meta.url));

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? sourceFiles(entryPath)
        : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
          ? [entryPath]
          : [];
    }),
  );
  return nested.flat();
}

describe("public catalog binding boundary", () => {
  it("keeps CATALOG_DB access in public-catalog.ts only", async () => {
    const files = await sourceFiles(sourceDirectory);
    const violations = (
      await Promise.all(
        files
          .filter(
            (file) =>
              !["public-catalog.ts", "public-catalog.binding.test.ts"].includes(
                path.basename(file),
              ),
          )
          .map(async (file) =>
            (await readFile(file, "utf8")).includes("CATALOG_DB") ? file : null,
          ),
      )
    ).filter((file): file is string => file !== null);

    expect(violations).toEqual([]);
  });
});

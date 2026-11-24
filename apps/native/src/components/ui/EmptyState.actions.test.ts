import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("bounds iOS inline action hosts to the column at accessibility sizes", () => {
  const source = readFileSync(
    new URL("./EmptyState.tsx", import.meta.url),
    "utf8",
  );
  expect(source).toContain("actionsInline && fontScale > 1.2");
  expect(
    source.match(
      /matchContents=\{stackActions \? \{ vertical: true \} : true\}/g,
    ),
  ).toHaveLength(2);
});

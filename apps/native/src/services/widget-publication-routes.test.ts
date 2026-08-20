import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const createSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/(home)/convention/create.tsx"),
  "utf8",
);
const importSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/(home)/convention/[id]/import.tsx"),
  "utf8",
);

describe("widget snapshot publication routes", () => {
  it("publishes a manually created convention before navigating away", () => {
    const createIndex = createSource.indexOf(
      "const convention = await conventionsRepo.create",
    );
    const publishIndex = createSource.indexOf(
      "await publishWidgetSnapshot()",
      createIndex,
    );
    const navigationIndex = createSource.indexOf("router.replace", createIndex);

    expect(createIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(createIndex);
    expect(navigationIndex).toBeGreaterThan(publishIndex);
  });

  it("seeds the created convention and its empty event list before navigation", () => {
    const createIndex = createSource.indexOf(
      "const convention = await conventionsRepo.create",
    );
    const conventionCacheIndex = createSource.indexOf(
      'queryClient.setQueryData(["convention", convention.id], convention)',
      createIndex,
    );
    const eventCacheIndex = createSource.indexOf(
      'queryClient.setQueryData(["events", convention.id], [])',
      createIndex,
    );
    const navigationIndex = createSource.indexOf("router.replace", createIndex);

    expect(conventionCacheIndex).toBeGreaterThan(createIndex);
    expect(eventCacheIndex).toBeGreaterThan(conventionCacheIndex);
    expect(navigationIndex).toBeGreaterThan(eventCacheIndex);
  });

  it("publishes updated convention metadata after an existing schedule import", () => {
    const metadataUpdateIndex = importSource.indexOf(
      "await conventionsRepo.update(conventionId",
    );
    const publishIndex = importSource.indexOf(
      "await publishWidgetSnapshot()",
      metadataUpdateIndex,
    );
    const successAlertIndex = importSource.indexOf(
      'Alert.alert(\n        t("import.alerts.successTitle")',
      metadataUpdateIndex,
    );

    expect(metadataUpdateIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(metadataUpdateIndex);
    expect(successAlertIndex).toBeGreaterThan(publishIndex);
  });
});

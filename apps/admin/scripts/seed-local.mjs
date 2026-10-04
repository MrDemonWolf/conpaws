import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildConPawsPreviewFixture } from "../../native/src/fixtures/conpaws-preview.ts";

const fixture = buildConPawsPreviewFixture();
const now = Date.parse(fixture.convention.updatedAt);
const quote = (value) =>
  value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const dateTimeInZone = (iso, timeZone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const statements = [
  `INSERT OR IGNORE INTO conventions (
    id, slug, name, acronym, city, region, country, starts_on, ends_on,
    timezone, venue, official_url, availability, schedule_status,
    source_verified_at, status, created_by, updated_by, created_at, updated_at
  ) VALUES (
    ${quote(fixture.convention.id)}, 'conpaws-preview-con',
    'ConPaws Preview Con (fictional)', '', 'Sample City', 'Demo',
    'United States', ${quote(fixture.convention.startDate)},
    ${quote(fixture.convention.endDate)}, ${quote(fixture.convention.timeZone)},
    'ConPaws Convention Center', 'https://example.com/conpaws-demo',
    'unknown', 'partial', NULL, 'draft', 'local-demo', 'local-demo', ${now}, ${now}
  );`,
  ...fixture.events.map(
    (event) => `INSERT OR IGNORE INTO schedule_events (
      id, convention_id, title, description, room, starts_at, ends_at,
      status, updated_by, updated_at
    ) VALUES (
      ${quote(event.id)}, ${quote(fixture.convention.id)}, ${quote(event.title)},
      ${quote(event.description)}, ${quote(event.room)},
      ${quote(dateTimeInZone(event.startTime, fixture.convention.timeZone))},
      ${quote(dateTimeInZone(event.endTime, fixture.convention.timeZone))},
      'scheduled', 'local-demo', ${now}
    );`,
  ),
  `INSERT OR IGNORE INTO audit_log (
    id, actor_email, action, resource_type, resource_id, summary, created_at
  ) VALUES (
    'conpaws-preview-seed-local', 'local-demo', 'convention.seeded',
    'convention', ${quote(fixture.convention.id)},
    'Fictional local preview with 200 synthetic schedule sessions; source is not verified.',
    ${now}
  );`,
].join("\n");

const directory = join(process.cwd(), ".wrangler");
const seedPath = join(directory, "seed-preview.local.sql");
await mkdir(directory, { recursive: true });
await writeFile(seedPath, statements, { mode: 0o600 });

const result = spawnSync(
  "bunx",
  [
    "wrangler",
    "d1",
    "execute",
    "CATALOG_DB",
    "--local",
    "--persist-to",
    ".wrangler/state",
    "--file",
    seedPath,
  ],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
else
  console.log(
    `Seeded ${fixture.events.length} fictional preview sessions locally.`,
  );

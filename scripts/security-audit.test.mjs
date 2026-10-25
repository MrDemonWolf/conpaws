import assert from "node:assert/strict";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateAudit,
  parseAuditOutput,
  parseExceptions,
  validateAuditStderr,
  validateNextExceptionSource,
  validateNextExceptionSourceTree,
} from "./security-audit.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const finding = {
  package: "example-package",
  id: "GHSA-2345-6789-cfgh",
  severity: "high",
  vulnerableVersions: "<2.0.0",
};

function auditJson(findings) {
  const packages = {};
  for (const item of findings) {
    packages[item.package] ??= [];
    packages[item.package].push({
      id: 1,
      url: `https://github.com/advisories/${item.id}`,
      title: "Example advisory",
      severity: item.severity,
      vulnerable_versions: item.vulnerableVersions,
    });
  }
  return JSON.stringify(packages);
}

function exception(item = finding, overrides = {}) {
  return {
    package: item.package,
    id: item.id,
    severity: item.severity,
    vulnerableVersions: item.vulnerableVersions,
    expires: "2026-11-15",
    owner: "Security owner",
    reachability: "Only used by trusted build tooling.",
    upstream: `https://github.com/advisories/${item.id}`,
    ...overrides,
  };
}

function exceptionsJson(exceptions) {
  return JSON.stringify({ version: 1, exceptions });
}

test("accepts exact unexpired exceptions and ignores lower severities", () => {
  const moderate = {
    ...finding,
    id: "GHSA-3456-789c-fghj",
    severity: "moderate",
  };

  assert.deepEqual(
    evaluateAudit(
      auditJson([finding, moderate]),
      exceptionsJson([exception()]),
      "2026-10-15",
    ),
    { total: 2, blocking: 1, excepted: 1 },
  );
});

test("rejects malformed or unsupported audit output", () => {
  assert.throws(() => parseAuditOutput("not JSON"), /malformed JSON/);
  assert.throws(() => parseAuditOutput("[]"), /object keyed by package name/);
  assert.throws(
    () => parseAuditOutput(auditJson([{ ...finding, severity: "unknown" }])),
    /severity is unsupported/,
  );
});

test("rejects duplicate audit findings", () => {
  assert.throws(
    () => parseAuditOutput(auditJson([finding, finding])),
    /duplicate finding/,
  );
  assert.throws(
    () =>
      parseAuditOutput(
        auditJson([finding, { ...finding, vulnerableVersions: "<3.0.0" }]),
      ),
    /duplicate finding/,
  );
});

test("rejects new high or critical findings", () => {
  assert.throws(
    () => evaluateAudit(auditJson([finding]), exceptionsJson([]), "2026-10-15"),
    /new high\/critical finding/,
  );
});

test("rejects changed finding severity or vulnerable range", () => {
  for (const changed of [
    { ...finding, severity: "critical" },
    { ...finding, vulnerableVersions: "<3.0.0" },
  ]) {
    assert.throws(
      () =>
        evaluateAudit(
          auditJson([changed]),
          exceptionsJson([exception()]),
          "2026-10-15",
        ),
      /changed high\/critical finding/,
    );
  }
});

test("rejects stale exceptions", () => {
  assert.throws(
    () => evaluateAudit("{}", exceptionsJson([exception()]), "2026-10-15"),
    /stale exception/,
  );
});

test("rejects exceptions on and after their expiry date", () => {
  assert.throws(
    () =>
      evaluateAudit(
        auditJson([finding]),
        exceptionsJson([exception(finding, { expires: "2026-10-15" })]),
        "2026-10-15",
      ),
    /expired exception/,
  );
});

test("rejects malformed and duplicate exceptions", () => {
  const withUnknownField = { ...exception(), typo: true };
  assert.throws(
    () => parseExceptions(exceptionsJson([withUnknownField])),
    /must contain exactly/,
  );
  assert.throws(
    () => parseExceptions(exceptionsJson([exception(), exception()])),
    /duplicate security audit exception/,
  );
  assert.throws(
    () =>
      parseExceptions(
        exceptionsJson([
          exception(),
          exception(finding, { vulnerableVersions: "<3.0.0" }),
        ]),
      ),
    /duplicate security audit exception/,
  );
});

test("allows Bun's version banner but rejects network errors", () => {
  assert.doesNotThrow(() =>
    validateAuditStderr(
      "\u001b[1mbun audit \u001b[2mv1.3.10 (30e609e0)\u001b[0m\n",
    ),
  );
  assert.throws(
    () =>
      validateAuditStderr(
        "error: POST https://registry.npmjs.org - DNSResolveFailed\n",
      ),
    /bun audit wrote to stderr/,
  );
});

test("keeps the excepted Next image paths out of production source", () => {
  assert.doesNotThrow(() => validateNextExceptionSourceTree(root));
});

test("rejects each direct Next image feature covered by the exceptions", () => {
  assert.throws(
    () =>
      validateNextExceptionSource([
        {
          path: "apps/web/src/app/image.tsx",
          source: 'import Image from "next/image.js";\nexport default Image;',
        },
        {
          path: "apps/web/src/app/opengraph.tsx",
          source: 'export { ImageResponse } from "next/og.js";',
        },
        {
          path: "apps/admin/src/app/card.tsx",
          source:
            'import Card from "next/dist/server/web/spec-extension/image-response.js";\nexport default Card;',
        },
        {
          path: "apps/web/next.config.ts",
          source:
            'export default { images: { domains: [], remotePatterns: [], formats: ["image/avif"] } };',
        },
      ]),
    (error) => {
      assert.match(error.message, /image\.tsx:1 uses next\/image/);
      assert.match(error.message, /opengraph\.tsx:1 uses next\/og/);
      assert.match(error.message, /opengraph\.tsx:1 uses ImageResponse/);
      assert.match(
        error.message,
        /card\.tsx:1 uses Next ImageResponse implementation/,
      );
      assert.match(
        error.message,
        /next\.config\.ts:1 uses images\.remotePatterns/,
      );
      assert.match(
        error.message,
        /next\.config\.ts:1 uses legacy images\.domains/,
      );
      assert.match(
        error.message,
        /next\.config\.ts:1 uses AVIF image optimization/,
      );
      return true;
    },
  );

  assert.doesNotThrow(() =>
    validateNextExceptionSource([
      {
        path: "apps/web/src/app/page.tsx",
        source: 'import type { Metadata } from "next";',
      },
    ]),
  );
});

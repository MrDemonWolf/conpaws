import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAudit,
  parseAuditOutput,
  parseExceptions,
  validateAuditStderr,
} from "./security-audit.mjs";

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
      "\u001b[1mbun audit \u001b[2mv1.4.4 (38afee6c8)\u001b[0m\n",
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

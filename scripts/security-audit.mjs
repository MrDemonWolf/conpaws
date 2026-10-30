#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SEVERITIES = new Set(["low", "moderate", "high", "critical"]);
const BLOCKING_SEVERITIES = new Set(["high", "critical"]);
const EXCEPTION_FIELDS = [
  "expires",
  "id",
  "owner",
  "package",
  "reachability",
  "severity",
  "upstream",
  "vulnerableVersions",
].sort();
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findingKey(finding) {
  return [
    finding.package,
    finding.id,
    finding.severity,
    finding.vulnerableVersions,
  ].join("\u0000");
}

function findingIdentity(finding) {
  return `${finding.package}:${finding.id}`;
}

function describeFinding(finding) {
  return `${finding.package} ${finding.id} ${finding.severity} ${finding.vulnerableVersions}`;
}

function requireNonemptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function parseGhsa(url, label) {
  let parsed;
  try {
    parsed = new URL(requireNonemptyString(url, label));
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }

  const match = parsed.pathname.match(
    /^\/advisories\/(GHSA-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})\/?$/,
  );
  if (parsed.hostname !== "github.com" || !match) {
    throw new Error(`${label} must be a GitHub Security Advisory URL`);
  }
  return match[1];
}

export function parseAuditOutput(raw) {
  let audit;
  try {
    audit = JSON.parse(raw);
  } catch (error) {
    throw new Error(`bun audit returned malformed JSON: ${error.message}`);
  }

  if (!isRecord(audit)) {
    throw new Error("bun audit JSON must be an object keyed by package name");
  }

  const findings = [];
  const seen = new Set();
  const seenIdentities = new Set();

  for (const [packageName, advisories] of Object.entries(audit)) {
    requireNonemptyString(packageName, "audit package name");
    if (!Array.isArray(advisories)) {
      throw new Error(`audit entry for ${packageName} must be an array`);
    }

    for (const [index, advisory] of advisories.entries()) {
      const label = `audit entry ${packageName}[${index}]`;
      if (!isRecord(advisory)) {
        throw new Error(`${label} must be an object`);
      }

      const severity = requireNonemptyString(
        advisory.severity,
        `${label}.severity`,
      ).toLowerCase();
      if (!SEVERITIES.has(severity)) {
        throw new Error(`${label}.severity is unsupported: ${severity}`);
      }

      const finding = {
        package: packageName,
        id: parseGhsa(advisory.url, `${label}.url`),
        severity,
        vulnerableVersions: requireNonemptyString(
          advisory.vulnerable_versions,
          `${label}.vulnerable_versions`,
        ),
      };

      const key = findingKey(finding);
      const identity = findingIdentity(finding);
      if (seen.has(key) || seenIdentities.has(identity)) {
        throw new Error(
          `bun audit returned a duplicate finding: ${describeFinding(finding)}`,
        );
      }
      seen.add(key);
      seenIdentities.add(identity);
      findings.push(finding);
    }
  }

  return findings;
}

function validateDate(date, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`${label} is not a valid date`);
  }
}

export function parseExceptions(raw) {
  let document;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `security audit exceptions contain malformed JSON: ${error.message}`,
    );
  }

  if (!isRecord(document)) {
    throw new Error(
      "security audit exceptions must contain version 1 and an exceptions array",
    );
  }
  const documentFields = Object.keys(document).sort();
  if (
    documentFields.join("\u0000") !== "exceptions\u0000version" ||
    document.version !== 1 ||
    !Array.isArray(document.exceptions)
  ) {
    throw new Error(
      "security audit exceptions must contain version 1 and an exceptions array",
    );
  }

  const exceptions = [];
  const seen = new Set();
  const seenIdentities = new Set();

  for (const [index, exception] of document.exceptions.entries()) {
    const label = `exception[${index}]`;
    if (!isRecord(exception)) {
      throw new Error(`${label} must be an object`);
    }
    const fields = Object.keys(exception).sort();
    if (fields.join("\u0000") !== EXCEPTION_FIELDS.join("\u0000")) {
      throw new Error(
        `${label} must contain exactly: ${EXCEPTION_FIELDS.join(", ")}`,
      );
    }

    const severity = requireNonemptyString(
      exception.severity,
      `${label}.severity`,
    ).toLowerCase();
    if (!BLOCKING_SEVERITIES.has(severity)) {
      throw new Error(`${label}.severity must be high or critical`);
    }

    const parsed = {
      package: requireNonemptyString(exception.package, `${label}.package`),
      id: requireNonemptyString(exception.id, `${label}.id`),
      severity,
      vulnerableVersions: requireNonemptyString(
        exception.vulnerableVersions,
        `${label}.vulnerableVersions`,
      ),
      expires: requireNonemptyString(exception.expires, `${label}.expires`),
      owner: requireNonemptyString(exception.owner, `${label}.owner`),
      reachability: requireNonemptyString(
        exception.reachability,
        `${label}.reachability`,
      ),
      upstream: requireNonemptyString(exception.upstream, `${label}.upstream`),
    };

    if (
      !/^GHSA-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(parsed.id)
    ) {
      throw new Error(`${label}.id must be a GHSA identifier`);
    }
    validateDate(parsed.expires, `${label}.expires`);
    try {
      const upstream = new URL(parsed.upstream);
      if (upstream.protocol !== "https:") {
        throw new Error("not HTTPS");
      }
      if (parseGhsa(parsed.upstream, `${label}.upstream`) !== parsed.id) {
        throw new Error("GHSA mismatch");
      }
    } catch {
      throw new Error(
        `${label}.upstream must be the matching HTTPS GitHub Security Advisory URL`,
      );
    }

    const key = findingKey(parsed);
    const identity = findingIdentity(parsed);
    if (seen.has(key) || seenIdentities.has(identity)) {
      throw new Error(
        `duplicate security audit exception: ${describeFinding(parsed)}`,
      );
    }
    seen.add(key);
    seenIdentities.add(identity);
    exceptions.push(parsed);
  }

  return exceptions;
}

export function evaluateAudit(
  auditRaw,
  exceptionsRaw,
  today = new Date().toISOString().slice(0, 10),
) {
  validateDate(today, "today");
  const findings = parseAuditOutput(auditRaw);
  const blocking = findings.filter((finding) =>
    BLOCKING_SEVERITIES.has(finding.severity),
  );
  const exceptions = parseExceptions(exceptionsRaw);
  const currentKeys = new Set(blocking.map(findingKey));
  const exceptionKeys = new Set(exceptions.map(findingKey));
  const currentIdentities = new Set(blocking.map(findingIdentity));
  const exceptionIdentities = new Set(exceptions.map(findingIdentity));
  const errors = [];

  for (const exception of exceptions) {
    if (exception.expires <= today) {
      errors.push(
        `expired exception (${exception.expires}): ${describeFinding(exception)}`,
      );
    }
  }

  for (const finding of blocking) {
    if (exceptionKeys.has(findingKey(finding))) {
      continue;
    }
    const prefix = exceptionIdentities.has(findingIdentity(finding))
      ? "changed"
      : "new";
    errors.push(`${prefix} high/critical finding: ${describeFinding(finding)}`);
  }

  for (const exception of exceptions) {
    if (!currentKeys.has(findingKey(exception))) {
      const prefix = currentIdentities.has(findingIdentity(exception))
        ? "changed"
        : "stale";
      errors.push(`${prefix} exception: ${describeFinding(exception)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `dependency audit gate failed:\n- ${errors.sort().join("\n- ")}`,
    );
  }

  return {
    total: findings.length,
    blocking: blocking.length,
    excepted: exceptions.length,
  };
}

export function validateAuditStderr(stderr) {
  const ansiEscape = new RegExp(`${String.fromCodePoint(27)}\\[[0-9;]*m`, "g");
  const lines = stderr
    .replaceAll(ansiEscape, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return;
  }
  if (
    lines.length === 1 &&
    /^bun audit v\d+\.\d+\.\d+ \([0-9a-f]+\)$/.test(lines[0])
  ) {
    return;
  }
  throw new Error(`bun audit wrote to stderr:\n${stderr.trim()}`);
}

function main() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const exceptionsPath = join(
    root,
    ".github",
    "security-audit-exceptions.json",
  );
  const audit = spawnSync("bun", ["audit", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (audit.error) {
    throw new Error(`could not run bun audit: ${audit.error.message}`);
  }
  if (audit.signal !== null || ![0, 1].includes(audit.status)) {
    throw new Error(
      `bun audit failed with ${audit.signal ?? `exit code ${audit.status}`}`,
    );
  }
  validateAuditStderr(audit.stderr);

  const result = evaluateAudit(
    audit.stdout,
    readFileSync(exceptionsPath, "utf8"),
  );
  console.log(
    `Dependency audit gate passed: ${result.blocking} high/critical findings match unexpired exceptions (${result.total} advisories total).`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

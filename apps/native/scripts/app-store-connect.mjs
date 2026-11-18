/**
 * App Store Connect API for ship-store.mjs: upload authentication for
 * xcodebuild and TestFlight distribution (groups, What to Test, Beta App
 * Review). No dependencies; Node's crypto signs the ES256 token.
 *
 * Credentials stay on this Mac:
 *   ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8   (downloaded once from
 *     App Store Connect > Users and Access > Integrations > Team Keys)
 *   ~/.appstoreconnect/conpaws.json  {"keyId": "...", "issuerId": "..."}
 * or ASC_KEY_ID / ASC_ISSUER_ID (and optionally ASC_KEY_PATH) in the
 * environment, the same names release-native.yml uses.
 */

import { createPrivateKey, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const API = "https://api.appstoreconnect.apple.com";
const KEY_ID = /^[A-Z0-9]{10}$/;
const ISSUER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Which TestFlight audiences a --beta value reaches. */
export const BETA_AUDIENCES = {
  private: { internal: true, external: false },
  public: { internal: false, external: true },
  both: { internal: true, external: true },
};

/**
 * Finds the API key without reading its contents. Returns null when nothing
 * is configured (uploads then use the account signed in to Xcode), or throws
 * when a configuration exists but is incomplete, so a typo never silently
 * falls back.
 *
 * @param {{
 *   env: Record<string, string | undefined>,
 *   home: string,
 *   exists?: (file: string) => boolean,
 *   read?: (file: string) => string,
 * }} options
 */
export function ascCredentials({
  env,
  home,
  exists = existsSync,
  read = (file) => readFileSync(file, "utf8"),
}) {
  const configPath = path.join(home, ".appstoreconnect/conpaws.json");
  let keyId = env.ASC_KEY_ID;
  let issuerId = env.ASC_ISSUER_ID;
  let source = "environment";
  if (!keyId && !issuerId && !env.ASC_KEY_PATH) {
    if (!exists(configPath)) return null;
    let config;
    try {
      config = JSON.parse(read(configPath));
    } catch {
      throw new Error(`${configPath} is not valid JSON.`);
    }
    keyId = config.keyId;
    issuerId = config.issuerId;
    source = configPath;
  }
  if (!KEY_ID.test(keyId ?? ""))
    throw new Error(
      `App Store Connect key ID from ${source} is missing or malformed.`,
    );
  if (!ISSUER_ID.test(issuerId ?? ""))
    throw new Error(
      `App Store Connect issuer ID from ${source} is missing or malformed.`,
    );
  const keyPath =
    env.ASC_KEY_PATH ||
    path.join(home, ".appstoreconnect/private_keys", `AuthKey_${keyId}.p8`);
  if (!exists(keyPath))
    throw new Error(`App Store Connect key file not found: ${keyPath}`);
  return { keyId, issuerId, keyPath };
}

/** xcodebuild flags that make archive/export use the API key instead of Xcode's login. */
export function xcodeAuthArgs(credentials) {
  if (!credentials) return [];
  return [
    "-authenticationKeyPath",
    credentials.keyPath,
    "-authenticationKeyID",
    credentials.keyId,
    "-authenticationKeyIssuerID",
    credentials.issuerId,
  ];
}

/** A short-lived ES256 token (Apple allows at most 20 minutes). */
export function ascToken({ keyId, issuerId, privateKey, now = Date.now() }) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const issuedAt = Math.floor(now / 1000);
  const unsigned = `${encode({ alg: "ES256", kid: keyId, typ: "JWT" })}.${encode(
    {
      iss: issuerId,
      iat: issuedAt,
      exp: issuedAt + 15 * 60,
      aud: "appstoreconnect-v1",
    },
  )}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${unsigned}.${signature.toString("base64url")}`;
}

/**
 * Problems with a --beta request before anything is uploaded or sent.
 *
 * @param {{ beta?: string, track: { variant: string, internalOnly?: boolean }, notes?: string }} options
 */
export function betaProblems({ beta, track, notes }) {
  if (!beta) return [];
  const audience = BETA_AUDIENCES[beta];
  if (!audience)
    return [`Unknown --beta "${beta}". Use private, public or both.`];
  const problems = [];
  if (audience.external && track.internalOnly)
    problems.push(
      `A ${track.variant} build never goes to external testers. Use --track public (production) for --beta ${beta}.`,
    );
  if (audience.external && !notes?.trim())
    problems.push(
      "External testers and Beta App Review need What to Test: add --notes or --notes-file.",
    );
  if (notes && notes.length > 4000)
    problems.push(
      `What to Test is ${notes.length} characters; the limit is 4000.`,
    );
  return problems;
}

/**
 * Splits the app's TestFlight groups for a --beta value. Internal groups with
 * access to all builds receive every processed build on their own.
 */
export function pickBetaGroups(groups, beta) {
  const audience = BETA_AUDIENCES[beta];
  const add = [];
  const automatic = [];
  const problems = [];
  const internal = groups.filter((group) => group.isInternalGroup);
  const external = groups.filter((group) => !group.isInternalGroup);
  if (audience.internal) {
    if (!internal.length)
      problems.push("The app has no internal TestFlight group.");
    for (const group of internal)
      (group.hasAccessToAllBuilds ? automatic : add).push(group);
  }
  if (audience.external) {
    if (!external.length)
      problems.push("The app has no external TestFlight group.");
    add.push(...external);
  }
  return { add, automatic, problems };
}

/** Reads a build resource's processing state. */
export function buildStatus(build) {
  if (!build) return "missing";
  const { processingState, expired } = build.attributes ?? {};
  if (expired) return "expired";
  if (processingState === "VALID") return "ready";
  if (processingState === "FAILED" || processingState === "INVALID")
    return "failed";
  return "processing";
}

/** What Beta App Review needs that the app's Test Information lacks. */
export function reviewReadiness({ localizations, reviewDetail }) {
  const problems = [];
  const english =
    localizations.find((item) => item.locale === "en-US") ?? localizations[0];
  if (!english?.description)
    problems.push("Test Information has no beta app description.");
  if (!english?.feedbackEmail)
    problems.push("Test Information has no feedback email.");
  const detail = reviewDetail ?? {};
  for (const field of [
    "contactFirstName",
    "contactLastName",
    "contactPhone",
    "contactEmail",
  ])
    if (!detail[field])
      problems.push(`Beta App Review information has no ${field}.`);
  if (detail.demoAccountRequired && !detail.demoAccountName)
    problems.push("Beta App Review requires a demo account but none is set.");
  return problems.map(
    (problem) =>
      `${problem} Fill it once in App Store Connect > TestFlight > Test Information.`,
  );
}

/** Thin App Store Connect client with a fresh token per request. */
export function createAscClient({
  credentials,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const privateKey = createPrivateKey(readFileSync(credentials.keyPath));
  const pause = (attempt) => sleep(attempt * 5_000);
  async function request(method, resource, body) {
    for (let attempt = 1; ; attempt++) {
      let response;
      try {
        response = await fetchImpl(`${API}${resource}`, {
          method,
          headers: {
            Authorization: `Bearer ${ascToken({ ...credentials, privateKey })}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(60_000),
        });
      } catch (error) {
        // A dropped GET is safe to repeat; a dropped POST may have landed.
        if (method === "GET" && attempt < 4) {
          await pause(attempt);
          continue;
        }
        throw error;
      }
      const retryable =
        response.status === 429 ||
        (response.status >= 500 && method !== "POST");
      if (retryable && attempt < 4) {
        await pause(attempt);
        continue;
      }
      const text = await response.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}
      if (!response.ok) {
        const error = json?.errors?.[0];
        const failure = new Error(
          `App Store Connect ${method} ${resource.split("?")[0]} failed (${response.status}): ${error?.detail ?? error?.title ?? text.slice(0, 200)}`,
        );
        failure.status = response.status;
        throw failure;
      }
      return json;
    }
  }
  return {
    get: (resource) => request("GET", resource),
    post: (resource, body) => request("POST", resource, body),
    patch: (resource, body) => request("PATCH", resource, body),
  };
}

async function findApp(client, bundleId) {
  const apps = await client.get(
    `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=name,bundleId`,
  );
  const app = apps.data.find((item) => item.attributes.bundleId === bundleId);
  if (!app)
    throw new Error(`No App Store Connect app with bundle ID ${bundleId}.`);
  return app;
}

async function findBuild(client, appId, version, build) {
  const builds = await client.get(
    `/v1/builds?filter[app]=${appId}&filter[version]=${build}&filter[preReleaseVersion.version]=${encodeURIComponent(version)}&fields[builds]=version,processingState,expired,usesNonExemptEncryption,buildAudienceType,uploadedDate&limit=5`,
  );
  return builds.data[0] ?? null;
}

/** The highest build number App Store Connect has for the app, uploaded from anywhere. */
export async function highestAscBuild({ client, bundleId }) {
  const app = await findApp(client, bundleId);
  // Build numbers are strings to Apple; compare them as numbers ourselves.
  const builds = await client.get(
    `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&fields[builds]=version&limit=200`,
  );
  return Math.max(
    0,
    ...builds.data
      .map((item) => Number(item.attributes.version))
      .filter(Number.isFinite),
  );
}

/**
 * Waits for an uploaded build to finish processing, then sends it to the
 * requested TestFlight audiences.
 *
 * @param {{
 *   client: { get: Function, post: Function, patch: Function },
 *   bundleId: string,
 *   version: string,
 *   build: number,
 *   beta: string,
 *   notes?: string,
 *   notBefore?: number,
 *   log?: (line: string) => void,
 *   wait?: (ms: number) => Promise<void>,
 *   pollMs?: number,
 *   timeoutMs?: number,
 * }} options
 */
export async function distributeTestFlightBuild({
  client,
  bundleId,
  version,
  build,
  beta,
  notes,
  notBefore,
  log = console.log,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  pollMs = 30_000,
  timeoutMs = 60 * 60_000,
}) {
  const app = await findApp(client, bundleId);
  const audience = BETA_AUDIENCES[beta];

  const groupsResponse = await client.get(
    `/v1/apps/${app.id}/betaGroups?fields[betaGroups]=name,isInternalGroup,hasAccessToAllBuilds&limit=50`,
  );
  const groups = groupsResponse.data.map((group) => ({
    id: group.id,
    ...group.attributes,
  }));
  const picked = pickBetaGroups(groups, beta);
  if (audience.external) {
    const [localizations, reviewDetail] = await Promise.all([
      client.get(
        `/v1/apps/${app.id}/betaAppLocalizations?fields[betaAppLocalizations]=locale,description,feedbackEmail`,
      ),
      client.get(`/v1/apps/${app.id}/betaAppReviewDetail`),
    ]);
    picked.problems.push(
      ...reviewReadiness({
        localizations: localizations.data.map((item) => item.attributes),
        reviewDetail: reviewDetail.data?.attributes,
      }),
    );
  }
  if (picked.problems.length) throw new Error(picked.problems.join("\n"));

  log(`Waiting for App Store Connect to process ${version} (${build})…`);
  const started = Date.now();
  let resource;
  for (;;) {
    resource = await findBuild(client, app.id, version, build);
    const status = buildStatus(resource);
    if (status === "ready") break;
    if (status === "failed" || status === "expired")
      throw new Error(`Build ${build} is ${status} in App Store Connect.`);
    if (Date.now() - started > timeoutMs)
      throw new Error(
        `Build ${build} was still ${status} after ${Math.round(timeoutMs / 60_000)} minutes. Re-run with --distribute-only once App Store Connect shows it.`,
      );
    await wait(pollMs);
  }
  log(`✓ Build ${build} processed.`);
  const uploadedAt = Date.parse(resource.attributes.uploadedDate ?? "");
  if (notBefore && !(uploadedAt >= notBefore - 5 * 60_000))
    throw new Error(
      `App Store Connect's build ${build} was uploaded ${resource.attributes.uploadedDate ?? "at an unknown time"}, before this archive existed, so it is not this archive's upload.`,
    );
  if (
    audience.external &&
    resource.attributes.buildAudienceType !== "APP_STORE_ELIGIBLE"
  )
    throw new Error(
      `Build ${build} is ${resource.attributes.buildAudienceType ?? "of unknown audience"} in App Store Connect (uploaded for internal testing only), so it cannot go to external testers.`,
    );
  if (resource.attributes.usesNonExemptEncryption == null)
    throw new Error(
      `Build ${build} has no export-compliance answer; ITSAppUsesNonExemptEncryption is missing from Info.plist.`,
    );

  if (notes?.trim()) {
    const existing = await client.get(
      `/v1/builds/${resource.id}/betaBuildLocalizations?fields[betaBuildLocalizations]=locale,whatsNew`,
    );
    const english = existing.data.find(
      (item) => item.attributes.locale === "en-US",
    );
    if (english)
      await client.patch(`/v1/betaBuildLocalizations/${english.id}`, {
        data: {
          type: "betaBuildLocalizations",
          id: english.id,
          attributes: { whatsNew: notes },
        },
      });
    else
      await client.post("/v1/betaBuildLocalizations", {
        data: {
          type: "betaBuildLocalizations",
          attributes: { locale: "en-US", whatsNew: notes },
          relationships: {
            build: { data: { type: "builds", id: resource.id } },
          },
        },
      });
    log("✓ What to Test set.");
  }

  for (const group of picked.automatic)
    log(`✓ ${group.name}: receives every build automatically.`);
  for (const group of picked.add) {
    await client.post(`/v1/betaGroups/${group.id}/relationships/builds`, {
      data: [{ type: "builds", id: resource.id }],
    });
    log(`✓ Added to ${group.name}.`);
  }

  if (audience.external) {
    try {
      const submission = await client.post("/v1/betaAppReviewSubmissions", {
        data: {
          type: "betaAppReviewSubmissions",
          relationships: {
            build: { data: { type: "builds", id: resource.id } },
          },
        },
      });
      log(
        `✓ Submitted for Beta App Review (${submission.data.attributes.betaReviewState ?? "WAITING_FOR_REVIEW"}). External testers get it once Apple approves.`,
      );
    } catch (error) {
      // 409 is Apple's generic "not valid"; only a live submission means done.
      if (error.status !== 409) throw error;
      let state;
      try {
        const current = await client.get(
          `/v1/builds/${resource.id}/betaAppReviewSubmission`,
        );
        state = current?.data?.attributes?.betaReviewState;
      } catch {}
      if (!["WAITING_FOR_REVIEW", "IN_REVIEW", "APPROVED"].includes(state))
        throw error;
      log(`✓ Beta App Review already requested (${state}).`);
    }
  }
}

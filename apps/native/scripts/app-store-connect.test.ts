import { generateKeyPairSync, verify } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ascCredentials,
  ascToken,
  betaProblems,
  buildStatus,
  createAscClient,
  distributeTestFlightBuild,
  highestAscBuild,
  pickBetaGroups,
  reviewReadiness,
  xcodeAuthArgs,
} from "./app-store-connect.mjs";
import { TRACKS } from "./ship-store.mjs";

const KEY = "ABCDE12345";
const ISSUER = "00000000-0000-4000-8000-000000000000";
const home = "/Users/test";
const keyFile = `${home}/.appstoreconnect/private_keys/AuthKey_${KEY}.p8`;
const configFile = `${home}/.appstoreconnect/conpaws.json`;

describe("ascCredentials", () => {
  const files = (entries: Record<string, string>) => ({
    exists: (file: string) => file in entries,
    read: (file: string) => entries[file],
  });

  it("is null when nothing is configured, so uploads keep using Xcode's account", () => {
    expect(ascCredentials({ env: {}, home, ...files({}) })).toBeNull();
  });

  it("reads the local config file and the conventional key path", () => {
    expect(
      ascCredentials({
        env: {},
        home,
        ...files({
          [configFile]: JSON.stringify({ keyId: KEY, issuerId: ISSUER }),
          [keyFile]: "",
        }),
      }),
    ).toEqual({ keyId: KEY, issuerId: ISSUER, keyPath: keyFile });
  });

  it("prefers the environment, as in CI", () => {
    expect(
      ascCredentials({
        env: { ASC_KEY_ID: KEY, ASC_ISSUER_ID: ISSUER, ASC_KEY_PATH: "/k.p8" },
        home,
        ...files({ "/k.p8": "" }),
      })?.keyPath,
    ).toBe("/k.p8");
  });

  it("throws instead of silently falling back when a configuration is broken", () => {
    expect(() =>
      ascCredentials({
        env: { ASC_KEY_ID: "short", ASC_ISSUER_ID: ISSUER },
        home,
        ...files({}),
      }),
    ).toThrow(/key ID/);
    expect(() =>
      ascCredentials({
        env: { ASC_KEY_ID: KEY },
        home,
        ...files({ [keyFile]: "" }),
      }),
    ).toThrow(/issuer ID/);
    expect(() =>
      ascCredentials({
        env: { ASC_KEY_ID: KEY, ASC_ISSUER_ID: ISSUER },
        home,
        ...files({}),
      }),
    ).toThrow(/key file not found/);
    expect(() =>
      ascCredentials({ env: {}, home, ...files({ [configFile]: "{" }) }),
    ).toThrow(/not valid JSON/);
    expect(() =>
      ascCredentials({
        env: { ASC_KEY_PATH: "/k.p8" },
        home,
        ...files({ "/k.p8": "" }),
      }),
    ).toThrow(/key ID/);
  });
});

describe("xcodeAuthArgs", () => {
  it("passes the key to xcodebuild, or nothing without one", () => {
    expect(xcodeAuthArgs(null)).toEqual([]);
    expect(
      xcodeAuthArgs({ keyId: KEY, issuerId: ISSUER, keyPath: keyFile }),
    ).toEqual([
      "-authenticationKeyPath",
      keyFile,
      "-authenticationKeyID",
      KEY,
      "-authenticationKeyIssuerID",
      ISSUER,
    ]);
  });
});

describe("ascToken", () => {
  it("signs a verifiable ES256 token that expires within Apple's 20 minutes", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const token = ascToken({
      keyId: KEY,
      issuerId: ISSUER,
      privateKey,
      now: 1_700_000_000_000,
    });
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: KEY,
      typ: "JWT",
    });
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims).toMatchObject({ iss: ISSUER, aud: "appstoreconnect-v1" });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(20 * 60);
    expect(
      verify(
        "sha256",
        Buffer.from(`${header}.${payload}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true);
  });
});

describe("betaProblems", () => {
  it("never sends a preview build to external testers", () => {
    for (const beta of ["public", "both"])
      expect(
        betaProblems({ beta, track: TRACKS.ios.testflight, notes: "x" }).join(
          " ",
        ),
      ).toMatch(/never goes to external/);
    expect(
      betaProblems({ beta: "private", track: TRACKS.ios.testflight }),
    ).toEqual([]);
  });

  it("needs What to Test for external testers and caps its length", () => {
    expect(
      betaProblems({ beta: "public", track: TRACKS.ios.public }).join(" "),
    ).toMatch(/What to Test/);
    expect(
      betaProblems({
        beta: "both",
        track: TRACKS.ios.public,
        notes: "x".repeat(4001),
      }).join(" "),
    ).toMatch(/limit is 4000/);
    expect(
      betaProblems({ beta: "both", track: TRACKS.ios.public, notes: "ok" }),
    ).toEqual([]);
    expect(betaProblems({ beta: undefined, track: TRACKS.ios.public })).toEqual(
      [],
    );
  });
});

describe("pickBetaGroups", () => {
  const groups = [
    {
      id: "i",
      name: "Private Beta",
      isInternalGroup: true,
      hasAccessToAllBuilds: true,
    },
    { id: "e", name: "External Beta", isInternalGroup: false },
  ];

  it("leaves automatic internal groups alone and adds external ones", () => {
    expect(pickBetaGroups(groups, "private")).toMatchObject({
      add: [],
      automatic: [{ id: "i" }],
      problems: [],
    });
    expect(pickBetaGroups(groups, "public")).toMatchObject({
      add: [{ id: "e" }],
      automatic: [],
    });
    expect(pickBetaGroups(groups, "both").add.map((g) => g.id)).toEqual(["e"]);
  });

  it("adds internal groups that do not get every build, and reports missing audiences", () => {
    expect(
      pickBetaGroups(
        [{ id: "i", name: "QA", isInternalGroup: true }],
        "private",
      ).add.map((g) => g.id),
    ).toEqual(["i"]);
    expect(pickBetaGroups([], "both").problems).toHaveLength(2);
  });
});

describe("buildStatus", () => {
  it("maps processing states", () => {
    expect(buildStatus(null)).toBe("missing");
    expect(buildStatus({ attributes: { processingState: "PROCESSING" } })).toBe(
      "processing",
    );
    expect(buildStatus({ attributes: { processingState: "VALID" } })).toBe(
      "ready",
    );
    expect(buildStatus({ attributes: { processingState: "INVALID" } })).toBe(
      "failed",
    );
    expect(
      buildStatus({ attributes: { processingState: "VALID", expired: true } }),
    ).toBe("expired");
  });
});

describe("reviewReadiness", () => {
  const complete = {
    contactFirstName: "A",
    contactLastName: "B",
    contactPhone: "1",
    contactEmail: "a@example.com",
    demoAccountRequired: false,
  };

  it("passes complete Test Information", () => {
    expect(
      reviewReadiness({
        localizations: [
          { locale: "en-US", description: "d", feedbackEmail: "f@example.com" },
        ],
        reviewDetail: complete,
      }),
    ).toEqual([]);
  });

  it("names every missing field", () => {
    const problems = reviewReadiness({
      localizations: [],
      reviewDetail: {
        ...complete,
        contactPhone: "",
        demoAccountRequired: true,
      },
    });
    expect(problems.join(" ")).toMatch(/description/);
    expect(problems.join(" ")).toMatch(/feedback email/);
    expect(problems.join(" ")).toMatch(/contactPhone/);
    expect(problems.join(" ")).toMatch(/demo account/);
  });
});

/** A scripted App Store Connect: maps "METHOD path-prefix" to responses. */
function fakeClient(
  routes: Record<string, (body?: unknown) => unknown>,
  calls: string[],
) {
  const handle =
    (method: string) => async (resource: string, body?: unknown) => {
      const key = `${method} ${resource}`;
      calls.push(key);
      const match = Object.keys(routes)
        .filter((prefix) => key.startsWith(prefix))
        .sort((a, b) => b.length - a.length)[0];
      if (!match) throw new Error(`unexpected ${key}`);
      return routes[match](body);
    };
  return { get: handle("GET"), post: handle("POST"), patch: handle("PATCH") };
}

const appRoute = {
  "GET /v1/apps?": () => ({
    data: [{ id: "app", attributes: { bundleId: "com.mrdemonwolf.conpaws" } }],
  }),
  "GET /v1/apps/app/betaGroups": () => ({
    data: [
      {
        id: "internal",
        attributes: {
          name: "Private Beta",
          isInternalGroup: true,
          hasAccessToAllBuilds: true,
        },
      },
      {
        id: "external",
        attributes: { name: "External Beta", isInternalGroup: false },
      },
    ],
  }),
  "GET /v1/apps/app/betaAppLocalizations": () => ({
    data: [
      {
        attributes: {
          locale: "en-US",
          description: "d",
          feedbackEmail: "f@example.com",
        },
      },
    ],
  }),
  "GET /v1/apps/app/betaAppReviewDetail": () => ({
    data: {
      attributes: {
        contactFirstName: "A",
        contactLastName: "B",
        contactPhone: "1",
        contactEmail: "a@example.com",
      },
    },
  }),
};

describe("distributeTestFlightBuild", () => {
  it("waits for processing, sets What to Test, adds External Beta and submits for review", async () => {
    const calls: string[] = [];
    const bodies: unknown[] = [];
    let polls = 0;
    const client = fakeClient(
      {
        ...appRoute,
        "GET /v1/builds?": () => ({
          data:
            ++polls < 3
              ? []
              : [
                  {
                    id: "b213",
                    attributes: {
                      version: "213",
                      processingState: polls < 4 ? "PROCESSING" : "VALID",
                      usesNonExemptEncryption: false,
                      buildAudienceType: "APP_STORE_ELIGIBLE",
                      uploadedDate: "2026-11-18T20:00:00Z",
                    },
                  },
                ],
        }),
        "GET /v1/builds/b213/betaBuildLocalizations": () => ({ data: [] }),
        "POST /v1/betaBuildLocalizations": (body) => {
          bodies.push(body);
          return {};
        },
        "POST /v1/betaGroups/external/relationships/builds": (body) => {
          bodies.push(body);
          return null;
        },
        "POST /v1/betaAppReviewSubmissions": (body) => {
          bodies.push(body);
          return {
            data: { attributes: { betaReviewState: "WAITING_FOR_REVIEW" } },
          };
        },
      },
      calls,
    );
    const log: string[] = [];
    await distributeTestFlightBuild({
      client,
      bundleId: "com.mrdemonwolf.conpaws",
      version: "1.0.0",
      build: 213,
      beta: "both",
      notes: "Try the Watch.",
      log: (line: string) => log.push(line),
      wait: async () => {},
    });
    expect(polls).toBe(4);
    expect(calls).not.toContain(
      "POST /v1/betaGroups/internal/relationships/builds",
    );
    expect(bodies).toEqual([
      {
        data: {
          type: "betaBuildLocalizations",
          attributes: { locale: "en-US", whatsNew: "Try the Watch." },
          relationships: { build: { data: { type: "builds", id: "b213" } } },
        },
      },
      { data: [{ type: "builds", id: "b213" }] },
      {
        data: {
          type: "betaAppReviewSubmissions",
          relationships: { build: { data: { type: "builds", id: "b213" } } },
        },
      },
    ]);
    expect(log.join("\n")).toMatch(/Private Beta: receives every build/);
    expect(log.join("\n")).toMatch(/Submitted for Beta App Review/);
  });

  it("updates an existing What to Test and tolerates an earlier review request", async () => {
    const calls: string[] = [];
    const client = fakeClient(
      {
        ...appRoute,
        "GET /v1/builds?": () => ({
          data: [
            {
              id: "b",
              attributes: {
                processingState: "VALID",
                usesNonExemptEncryption: false,
                buildAudienceType: "APP_STORE_ELIGIBLE",
              },
            },
          ],
        }),
        "GET /v1/builds/b/betaBuildLocalizations": () => ({
          data: [{ id: "loc", attributes: { locale: "en-US" } }],
        }),
        "PATCH /v1/betaBuildLocalizations/loc": () => ({}),
        "POST /v1/betaGroups/external/relationships/builds": () => null,
        "POST /v1/betaAppReviewSubmissions": () => {
          throw Object.assign(new Error("conflict"), { status: 409 });
        },
        "GET /v1/builds/b/betaAppReviewSubmission": () => ({
          data: { attributes: { betaReviewState: "APPROVED" } },
        }),
      },
      calls,
    );
    const log: string[] = [];
    await distributeTestFlightBuild({
      client,
      bundleId: "com.mrdemonwolf.conpaws",
      version: "1.0.0",
      build: 213,
      beta: "public",
      notes: "n",
      log: (line: string) => log.push(line),
      wait: async () => {},
    });
    expect(calls).toContain("PATCH /v1/betaBuildLocalizations/loc");
    expect(log.join("\n")).toMatch(/already requested \(APPROVED\)/);
  });

  it("refuses before waiting when Test Information is incomplete", async () => {
    const calls: string[] = [];
    const client = fakeClient(
      {
        ...appRoute,
        "GET /v1/apps/app/betaAppReviewDetail": () => ({
          data: { attributes: {} },
        }),
      },
      calls,
    );
    await expect(
      distributeTestFlightBuild({
        client,
        bundleId: "com.mrdemonwolf.conpaws",
        version: "1.0.0",
        build: 213,
        beta: "public",
        notes: "n",
        log: () => {},
        wait: async () => {},
      }),
    ).rejects.toThrow(/contactFirstName/);
    expect(calls.some((call) => call.startsWith("GET /v1/builds?"))).toBe(
      false,
    );
  });

  it("stops on a failed build and on a timeout", async () => {
    const failed = fakeClient(
      {
        ...appRoute,
        "GET /v1/builds?": () => ({
          data: [{ id: "b", attributes: { processingState: "INVALID" } }],
        }),
      },
      [],
    );
    await expect(
      distributeTestFlightBuild({
        client: failed,
        bundleId: "com.mrdemonwolf.conpaws",
        version: "1.0.0",
        build: 213,
        beta: "private",
        log: () => {},
        wait: async () => {},
      }),
    ).rejects.toThrow(/failed/);
    const never = fakeClient(
      { ...appRoute, "GET /v1/builds?": () => ({ data: [] }) },
      [],
    );
    await expect(
      distributeTestFlightBuild({
        client: never,
        bundleId: "com.mrdemonwolf.conpaws",
        version: "1.0.0",
        build: 213,
        beta: "private",
        log: () => {},
        wait: async () => {},
        timeoutMs: -1,
      }),
    ).rejects.toThrow(/--distribute-only/);
  });
});

const validBuild = (attributes: Record<string, unknown> = {}) => ({
  data: [
    {
      id: "b",
      attributes: {
        processingState: "VALID",
        usesNonExemptEncryption: false,
        buildAudienceType: "APP_STORE_ELIGIBLE",
        uploadedDate: "2026-11-18T20:00:00Z",
        ...attributes,
      },
    },
  ],
});

function publicRun(
  routes: Record<string, (body?: unknown) => unknown>,
  extra = {},
) {
  const calls: string[] = [];
  const client = fakeClient(
    {
      ...appRoute,
      "GET /v1/builds?": () => validBuild(),
      "GET /v1/builds/b/betaBuildLocalizations": () => ({ data: [] }),
      "POST /v1/betaBuildLocalizations": () => ({}),
      "POST /v1/betaGroups/external/relationships/builds": () => null,
      ...routes,
    },
    calls,
  );
  const run = distributeTestFlightBuild({
    client,
    bundleId: "com.mrdemonwolf.conpaws",
    version: "1.0.0",
    build: 213,
    beta: "public",
    notes: "n",
    log: () => {},
    wait: async () => {},
    ...extra,
  });
  return { run, calls };
}

describe("distributeTestFlightBuild refusals", () => {
  const conflict = () => {
    throw Object.assign(new Error("409 not valid"), { status: 409 });
  };

  it("does not call a 409 a submission unless one is live", async () => {
    for (const current of [
      () => ({ data: null }),
      () => ({ data: { attributes: { betaReviewState: "REJECTED" } } }),
      () => {
        throw Object.assign(new Error("404"), { status: 404 });
      },
    ]) {
      const { run } = publicRun({
        "POST /v1/betaAppReviewSubmissions": conflict,
        "GET /v1/builds/b/betaAppReviewSubmission": current,
      });
      await expect(run).rejects.toThrow(/409 not valid/);
    }
  });

  it("refuses an internal-only build for external testers before adding it anywhere", async () => {
    const { run, calls } = publicRun({
      "GET /v1/builds?": () =>
        validBuild({ buildAudienceType: "INTERNAL_ONLY" }),
    });
    await expect(run).rejects.toThrow(/internal testing only/);
    expect(calls.some((call) => call.startsWith("POST"))).toBe(false);
  });

  it("refuses a build uploaded before the archive existed", async () => {
    const { run, calls } = publicRun(
      {},
      { notBefore: Date.parse("2026-11-19T00:00:00Z") },
    );
    await expect(run).rejects.toThrow(/not this archive's upload/);
    expect(calls.some((call) => call.startsWith("POST"))).toBe(false);
  });

  it("asks App Store Connect for the fields it checks", async () => {
    const { run, calls } = publicRun({
      "POST /v1/betaAppReviewSubmissions": () => ({
        data: { attributes: { betaReviewState: "WAITING_FOR_REVIEW" } },
      }),
    });
    await run;
    const lookup =
      calls.find((call) => call.startsWith("GET /v1/builds?")) ?? "";
    for (const part of [
      "filter[app]=app",
      "filter[version]=213",
      "filter[preReleaseVersion.version]=1.0.0",
      "buildAudienceType",
      "uploadedDate",
    ])
      expect(lookup).toContain(part);
    expect(calls).toContain(
      "GET /v1/builds/b/betaBuildLocalizations?fields[betaBuildLocalizations]=locale,whatsNew",
    );
  });
});

describe("createAscClient", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "asc-test-"));
  const keyPath = path.join(dir, "AuthKey_TEST.p8");
  writeFileSync(
    keyPath,
    generateKeyPairSync("ec", { namedCurve: "P-256" })
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString(),
  );
  const credentials = { keyId: KEY, issuerId: ISSUER, keyPath };
  const reply = (status: number, body = "") =>
    new Response(body || null, { status });

  it("returns null for 204, and keeps the status and Apple's detail on errors", async () => {
    const responses = [
      reply(204),
      reply(409, JSON.stringify({ errors: [{ detail: "already in review" }] })),
      reply(502, "<html>bad gateway</html>"),
    ];
    const client = createAscClient({
      credentials,
      fetchImpl: async () => responses.shift() as Response,
      sleep: async () => {},
    });
    expect(await client.post("/v1/x", {})).toBeNull();
    await expect(client.post("/v1/x", {})).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("already in review"),
    });
    await expect(client.post("/v1/x", {})).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("bad gateway"),
    });
  });

  it("retries a GET after a dropped connection or a 503, but never a POST", async () => {
    let gets = 0;
    const client = createAscClient({
      credentials,
      fetchImpl: async (_url, init) => {
        if (init?.method === "POST") throw new TypeError("fetch failed");
        gets++;
        if (gets === 1) throw new TypeError("fetch failed");
        if (gets === 2) return reply(503);
        return reply(200, JSON.stringify({ data: [] }));
      },
      sleep: async () => {},
    });
    expect(await client.get("/v1/builds")).toEqual({ data: [] });
    expect(gets).toBe(3);
    await expect(client.post("/v1/x", {})).rejects.toThrow(/fetch failed/);
  });

  it("signs each request with a bearer token", async () => {
    let header = "";
    const client = createAscClient({
      credentials,
      fetchImpl: async (_url, init) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        header = String(headers.Authorization);
        return reply(200, "{}");
      },
    });
    await client.get("/v1/apps");
    expect(header).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  });
});

describe("highestAscBuild", () => {
  it("reads the newest build number App Store Connect has", async () => {
    const client = fakeClient(
      {
        ...appRoute,
        "GET /v1/builds?": () => ({
          data: [
            { attributes: { version: "212" } },
            { attributes: { version: "1002" } },
            { attributes: { version: "213" } },
          ],
        }),
      },
      [],
    );
    expect(
      await highestAscBuild({ client, bundleId: "com.mrdemonwolf.conpaws" }),
    ).toBe(1002);
  });
});

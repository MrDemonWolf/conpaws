import { describe, expect, it } from "vitest";
import { getSentryOptions, isValidPublicSentryDsn } from "./sentry-config";

const VALID_DSN = "https://public@example.invalid/1";

describe("Sentry startup configuration", () => {
  it("accepts only public HTTPS DSNs that the Sentry parser can use", () => {
    expect(isValidPublicSentryDsn(VALID_DSN)).toBe(true);
    expect(isValidPublicSentryDsn(` ${VALID_DSN} `)).toBe(true);
    expect(
      isValidPublicSentryDsn(
        "https://public_123@example.invalid:8443/sentry/42",
      ),
    ).toBe(true);

    for (const invalidDsn of [
      "http://public@example.invalid/1",
      "https://example.invalid/1",
      "https://public:private@example.invalid/1",
      "https://public@example.invalid:private/1",
      "https://public@ example.invalid/1",
      "https://public@example.invalid:99999/1",
      "https://public%3Aprivate@example.invalid/1",
      "https://public@ü.example/1",
      "https://public@example.invalid/project",
      "https://public@example.invalid/1/",
      "https://public@example.invalid/1?environment=production",
      "https://public@example.invalid/1#fragment",
    ]) {
      expect(isValidPublicSentryDsn(invalidDsn), invalidDsn).toBe(false);
    }
  });

  it("does not start the native SDK without a release DSN", () => {
    expect(getSentryOptions(false, undefined)).toBeNull();
    expect(getSentryOptions(false, "   ")).toBeNull();
    expect(getSentryOptions(false, "placeholder")).toBeNull();
    expect(getSentryOptions(false, "https://example.invalid/1")).toBeNull();
    expect(
      getSentryOptions(false, "https://public@example.invalid/project"),
    ).toBeNull();
    expect(
      getSentryOptions(false, "https://public:private@example.invalid/1"),
    ).toBeNull();
    expect(
      getSentryOptions(true, "https://public@example.invalid/1"),
    ).toBeNull();
  });

  it("starts the native SDK for a configured release", () => {
    expect(getSentryOptions(false, ` ${VALID_DSN} `)).toEqual({
      beforeBreadcrumb: expect.any(Function),
      beforeSend: expect.any(Function),
      dsn: "https://public@example.invalid/1",
      sendDefaultPii: false,
    });
  });

  it("removes sentinel user content while preserving stable error metadata", () => {
    const options = getSentryOptions(false, VALID_DSN);
    const sentinel = "private-schedule-token";
    const stacktrace = {
      frames: [
        {
          filename: "app:///schedule-refresh.ts",
          function: "refreshSchedule",
          lineno: 42,
          vars: { schedule: sentinel },
        },
      ],
    };

    const redacted = options?.beforeSend({
      type: undefined,
      event_id: "c".repeat(32),
      timestamp: 1,
      level: "error",
      platform: "javascript",
      release: "com.mrdemonwolf.conpaws@1.0.0",
      dist: "1001",
      environment: "production",
      modules: { expo: "57.0.29" },
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: "app:///index.js",
            debug_id: "debug-id",
          },
        ],
      },
      message: `Could not read ${sentinel}`,
      logentry: { message: sentinel, params: [sentinel] },
      request: { url: `https://example.com/feed.ics?token=${sentinel}` },
      server_name: sentinel,
      logger: sentinel,
      transaction: `/convention/${sentinel}`,
      fingerprint: [sentinel],
      user: { email: `${sentinel}@example.com` },
      tags: {
        scope: "schedule-refresh.apply",
        platform: "ios",
        private: sentinel,
      },
      extra: { fileName: `${sentinel}.json`, schedule: sentinel },
      sdkProcessingMetadata: {
        dynamicSamplingContext: {
          trace_id: "a".repeat(32),
          public_key: "public",
          transaction: sentinel,
          replay_id: sentinel,
        },
        ipAddress: sentinel,
      },
      exception: {
        values: [
          {
            type: "InvalidScheduleUrlError",
            value: sentinel,
            stacktrace,
            mechanism: {
              type: "generic",
              handled: true,
              data: { source: sentinel },
              source: sentinel,
            },
          },
        ],
      },
      breadcrumbs: [
        {
          category: "navigation",
          level: "info",
          message: `/convention/${sentinel}`,
          data: { url: `https://example.com/?token=${sentinel}` },
        },
      ],
    });

    expect(JSON.stringify(redacted)).not.toContain(sentinel);
    expect(redacted).toMatchObject({
      event_id: "c".repeat(32),
      timestamp: 1,
      level: "error",
      platform: "javascript",
      release: "com.mrdemonwolf.conpaws@1.0.0",
      dist: "1001",
      environment: "production",
      modules: { expo: "57.0.29" },
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: "app:///index.js",
            debug_id: "debug-id",
          },
        ],
      },
      message: "ConPaws report: schedule-refresh.apply",
      logentry: { message: "ConPaws report: schedule-refresh.apply" },
      tags: { scope: "schedule-refresh.apply", platform: "ios" },
      exception: {
        values: [
          {
            type: "InvalidScheduleUrlError",
            stacktrace: {
              frames: [
                {
                  filename: "app:///schedule-refresh.ts",
                  function: "refreshSchedule",
                  lineno: 42,
                },
              ],
            },
            mechanism: { type: "generic", handled: true },
          },
        ],
      },
      breadcrumbs: [{ category: "navigation", level: "info" }],
      sdkProcessingMetadata: {
        dynamicSamplingContext: {
          trace_id: "a".repeat(32),
          public_key: "public",
        },
      },
    });
    expect(redacted).not.toHaveProperty("request");
    expect(redacted).not.toHaveProperty("transaction");
    expect(redacted).not.toHaveProperty("fingerprint");
    expect(redacted).not.toHaveProperty("user");
    expect(redacted).not.toHaveProperty("extra");
    expect(redacted).not.toHaveProperty("server_name");
    expect(redacted).not.toHaveProperty("logger");
  });

  it("allowlists contexts, threads, and spans without losing crash mechanics", () => {
    const options = getSentryOptions(false, VALID_DSN);
    const sentinel = "private-schedule-token";
    const traceId = "a".repeat(32);
    const spanId = "b".repeat(16);

    const redacted = options?.beforeSend({
      type: undefined,
      contexts: {
        app: { app_name: "ConPaws", app_version: "1.0.0" },
        device: {
          model: "iPhone",
          simulator: false,
          name: sentinel,
          device_unique_identifier: sentinel,
        },
        trace: {
          trace_id: traceId,
          span_id: spanId,
          op: "ui.load",
          data: { schedule: sentinel },
          tags: { schedule: sentinel },
          links: [
            { trace_id: traceId, span_id: spanId, attributes: { sentinel } },
          ],
        },
        ota_updates: {
          is_enabled: true,
          channel: "production",
          emergency_launch_reason: sentinel,
        },
        react_native_context: {
          js_engine: "hermes",
          expo_sdk_version: "57",
          component_stack: sentinel,
        },
        response: { headers: { authorization: sentinel } },
        custom: { schedule: sentinel },
      },
      threads: {
        values: [
          {
            id: 7,
            name: sentinel,
            main: true,
            crashed: true,
            stacktrace: {
              frames: [
                {
                  filename: "app:///schedule-refresh.ts",
                  function: "refreshSchedule",
                  lineno: 42,
                  colno: 8,
                  abs_path: `/private/${sentinel}`,
                  context_line: sentinel,
                  pre_context: [sentinel],
                  post_context: [sentinel],
                  vars: { schedule: sentinel },
                  module_metadata: { schedule: sentinel },
                },
              ],
            },
          },
        ],
      },
      spans: [
        {
          data: { schedule: sentinel },
          description: sentinel,
          span_id: spanId,
          start_timestamp: 1,
          status: "ok",
          timestamp: 2,
          trace_id: traceId,
          links: [
            { trace_id: traceId, span_id: spanId, attributes: { sentinel } },
          ],
          measurements: { secret: { value: 1, unit: sentinel } },
          profile_id: sentinel,
        },
      ],
    });

    expect(JSON.stringify(redacted)).not.toContain(sentinel);
    expect(redacted).toMatchObject({
      contexts: {
        app: { app_name: "ConPaws", app_version: "1.0.0" },
        device: { model: "iPhone", simulator: false },
        trace: { trace_id: traceId, span_id: spanId, op: "ui.load" },
        ota_updates: { is_enabled: true, channel: "production" },
        react_native_context: {
          js_engine: "hermes",
          expo_sdk_version: "57",
        },
      },
      threads: {
        values: [
          {
            id: 7,
            main: true,
            crashed: true,
            stacktrace: {
              frames: [
                {
                  filename: "app:///schedule-refresh.ts",
                  function: "refreshSchedule",
                  lineno: 42,
                  colno: 8,
                },
              ],
            },
          },
        ],
      },
      spans: [
        {
          data: {},
          span_id: spanId,
          start_timestamp: 1,
          status: "ok",
          timestamp: 2,
          trace_id: traceId,
        },
      ],
    });
    expect(redacted).not.toHaveProperty("contexts.response");
    expect(redacted).not.toHaveProperty("contexts.custom");
    expect(redacted).not.toHaveProperty("threads.values.0.name");
    expect(redacted).not.toHaveProperty(
      "threads.values.0.stacktrace.frames.0.vars",
    );
    expect(redacted).not.toHaveProperty("spans.0.description");
    expect(redacted).not.toHaveProperty("spans.0.links");
  });

  it("redacts breadcrumb messages and data before they are stored", () => {
    const options = getSentryOptions(false, VALID_DSN);

    expect(
      options?.beforeBreadcrumb({
        type: "http",
        category: "fetch",
        level: "info",
        timestamp: 1,
        message: "private-schedule-token",
        data: { url: "https://example.com/?token=private-schedule-token" },
      }),
    ).toEqual({
      type: "http",
      category: "fetch",
      level: "info",
      timestamp: 1,
    });
  });
});

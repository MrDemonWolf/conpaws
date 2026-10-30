import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

const REDACTED_EVENT_MESSAGE = "ConPaws report";
const SENTRY_DSN_PATTERN =
  /^https:\/\/(\w+)(?::(\w*))?@(\[[:.%\w]+\]|[\w.-]+)(?::(\d+))?\/(.+)$/;
// Arbitrary tag values may carry user input, so only reviewed runtime labels leave the device.
const SAFE_TAG_KEYS = new Set([
  "hermes",
  "platform",
  "scheme",
  "scope",
  "store",
]);

type EventException = NonNullable<
  NonNullable<ErrorEvent["exception"]>["values"]
>[number];
type EventMechanism = NonNullable<EventException["mechanism"]>;
type EventStacktrace = NonNullable<EventException["stacktrace"]>;
type EventStackFrame = NonNullable<EventStacktrace["frames"]>[number];
type EventSpan = NonNullable<ErrorEvent["spans"]>[number];
type EventSdkProcessingMetadata = NonNullable<
  ErrorEvent["sdkProcessingMetadata"]
>;
type EventThread = NonNullable<
  NonNullable<ErrorEvent["threads"]>["values"]
>[number];

function definedProperties<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;
}

function redactBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return definedProperties({
    type: breadcrumb.type,
    level: breadcrumb.level,
    event_id: breadcrumb.event_id,
    category: breadcrumb.category,
    timestamp: breadcrumb.timestamp,
  });
}

function redactStackFrame(frame: EventStackFrame): EventStackFrame {
  return definedProperties({
    filename: frame.filename,
    function: frame.function,
    module: frame.module,
    platform: frame.platform,
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
    instruction_addr: frame.instruction_addr,
    addr_mode: frame.addr_mode,
    debug_id: frame.debug_id,
  });
}

function redactStacktrace(stacktrace: EventStacktrace): EventStacktrace {
  return definedProperties({
    frames: stacktrace.frames?.map(redactStackFrame),
    frames_omitted: stacktrace.frames_omitted,
  });
}

function redactMechanism(mechanism: EventMechanism): EventMechanism {
  return definedProperties({
    type: mechanism.type,
    handled: mechanism.handled,
    synthetic: mechanism.synthetic,
    is_exception_group: mechanism.is_exception_group,
    exception_id: mechanism.exception_id,
    parent_id: mechanism.parent_id,
  }) as EventMechanism;
}

function redactException(exception: EventException): EventException {
  return definedProperties({
    type: exception.type,
    module: exception.module,
    thread_id: exception.thread_id,
    mechanism: exception.mechanism
      ? redactMechanism(exception.mechanism)
      : undefined,
    stacktrace: exception.stacktrace
      ? redactStacktrace(exception.stacktrace)
      : undefined,
  });
}

function redactThread(thread: EventThread): EventThread {
  return definedProperties({
    id: thread.id,
    main: thread.main,
    crashed: thread.crashed,
    current: thread.current,
    stacktrace: thread.stacktrace
      ? redactStacktrace(thread.stacktrace)
      : undefined,
  });
}

function redactSpan(span: EventSpan): EventSpan {
  return definedProperties({
    // Span attributes are app-defined and may contain user data; keep the span shell only.
    data: {},
    span_id: span.span_id,
    start_timestamp: span.start_timestamp,
    trace_id: span.trace_id,
    op: span.op,
    parent_span_id: span.parent_span_id,
    status: span.status,
    timestamp: span.timestamp,
    origin: span.origin,
    exclusive_time: span.exclusive_time,
    is_segment: span.is_segment,
    segment_id: span.segment_id,
  }) as EventSpan;
}

function redactSdkProcessingMetadata(
  metadata: ErrorEvent["sdkProcessingMetadata"],
): EventSdkProcessingMetadata | undefined {
  const dynamic = metadata?.dynamicSamplingContext;
  if (!dynamic) return undefined;

  return {
    dynamicSamplingContext: definedProperties({
      trace_id: dynamic.trace_id,
      public_key: dynamic.public_key,
      sample_rate: dynamic.sample_rate,
      release: dynamic.release,
      environment: dynamic.environment,
      sampled: dynamic.sampled,
      sample_rand: dynamic.sample_rand,
      org_id: dynamic.org_id,
    }),
  };
}

function redactTags(tags: ErrorEvent["tags"]): ErrorEvent["tags"] {
  if (!tags) return undefined;

  const safeTags: NonNullable<ErrorEvent["tags"]> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (
      SAFE_TAG_KEYS.has(key) &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean")
    ) {
      safeTags[key] = value;
    }
  }
  return Object.keys(safeTags).length > 0 ? safeTags : undefined;
}

function isContextValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function pickContext(
  context: Record<string, unknown> | undefined,
  keys: readonly string[],
): Record<string, string | number | boolean> | undefined {
  if (!context) return undefined;

  const safe: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    const value = context[key];
    if (isContextValue(value)) safe[key] = value;
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function redactContexts(
  contexts: ErrorEvent["contexts"],
): ErrorEvent["contexts"] {
  if (!contexts) return undefined;

  // SDK contexts can grow or contain identifiers; copy only reviewed diagnostics below.
  const safeContexts: Record<
    string,
    Record<string, string | number | boolean>
  > = {};
  const allowed = [
    [
      "app",
      [
        "app_name",
        "app_start_time",
        "app_version",
        "app_identifier",
        "build_type",
        "app_memory",
        "free_memory",
        "in_foreground",
      ],
    ],
    [
      "device",
      [
        "family",
        "model",
        "model_id",
        "arch",
        "orientation",
        "manufacturer",
        "brand",
        "screen_resolution",
        "screen_height_pixels",
        "screen_width_pixels",
        "screen_density",
        "screen_dpi",
        "online",
        "charging",
        "low_memory",
        "simulator",
        "memory_size",
        "free_memory",
        "usable_memory",
        "processor_count",
        "cpu_description",
        "processor_frequency",
        "device_type",
      ],
    ],
    ["os", ["name", "version", "build", "kernel_version"]],
    ["culture", ["calendar", "locale", "is_24_hour_format", "timezone"]],
    [
      "trace",
      ["trace_id", "parent_span_id", "span_id", "status", "op", "origin"],
    ],
    [
      "ota_updates",
      [
        "is_enabled",
        "is_embedded_launch",
        "is_emergency_launch",
        "is_using_embedded_assets",
        "update_id",
        "channel",
        "runtime_version",
        "check_automatically",
        "launch_duration",
        "created_at",
      ],
    ],
    [
      "react_native_context",
      [
        "turbo_module",
        "fabric",
        "react_native_version",
        "expo",
        "js_engine",
        "hermes_version",
        "hermes_debug_info",
        "expo_go_version",
        "expo_sdk_version",
      ],
    ],
  ] as const;

  for (const [name, keys] of allowed) {
    const context = pickContext(contexts[name], keys);
    if (context) safeContexts[name] = context;
  }

  return Object.keys(safeContexts).length > 0
    ? (safeContexts as NonNullable<ErrorEvent["contexts"]>)
    : undefined;
}

function redactEvent(event: ErrorEvent): ErrorEvent {
  // Build a fresh event allowlist so future Sentry fields cannot leak by default.
  const tags = redactTags(event.tags);
  const scope = tags?.scope;
  const safeMessage =
    typeof scope === "string" && scope
      ? `${REDACTED_EVENT_MESSAGE}: ${scope}`
      : REDACTED_EVENT_MESSAGE;

  return {
    type: undefined,
    ...definedProperties({
      event_id: event.event_id,
      timestamp: event.timestamp,
      start_timestamp: event.start_timestamp,
      level: event.level,
      platform: event.platform,
      release: event.release,
      dist: event.dist,
      environment: event.environment,
      sdk: event.sdk,
      modules: event.modules,
      debug_meta: event.debug_meta,
      sdkProcessingMetadata: redactSdkProcessingMetadata(
        event.sdkProcessingMetadata,
      ),
      message: event.message === undefined ? undefined : safeMessage,
      logentry:
        event.logentry === undefined ? undefined : { message: safeMessage },
      exception:
        event.exception === undefined
          ? undefined
          : { values: event.exception.values?.map(redactException) },
      breadcrumbs: event.breadcrumbs?.map(redactBreadcrumb),
      contexts: redactContexts(event.contexts),
      tags,
      spans: event.spans?.map(redactSpan),
      threads:
        event.threads === undefined
          ? undefined
          : { values: event.threads.values.map(redactThread) },
    }),
  };
}

export function isValidPublicSentryDsn(dsn: string): boolean {
  // Client bundles may contain the public key only, never a secret DSN credential or HTTP endpoint.
  try {
    const configuredDsn = dsn.trim();
    const match = SENTRY_DSN_PATTERN.exec(configuredDsn);
    const url = new URL(configuredDsn);
    const projectId = url.pathname.split("/").at(-1);
    return Boolean(
      match &&
        url.protocol === "https:" &&
        url.password === "" &&
        url.hostname &&
        projectId &&
        /^\d+$/.test(projectId) &&
        url.search === "" &&
        url.hash === "",
    );
  } catch {
    return false;
  }
}

export function getSentryOptions(isDev: boolean, dsn: string | undefined) {
  const configuredDsn = dsn?.trim();
  if (isDev || !configuredDsn || !isValidPublicSentryDsn(configuredDsn)) {
    return null;
  }

  return {
    beforeBreadcrumb: redactBreadcrumb,
    beforeSend: redactEvent,
    dsn: configuredDsn,
    sendDefaultPii: false as const,
  };
}

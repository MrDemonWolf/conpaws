import { z } from "zod";

/**
 * Deploy-time environment for `packages/infra/alchemy.run.ts`.
 *
 * This is a different population from `./web`. Nothing here is ever read by
 * the site at runtime: Alchemy reads these on the deploying machine and binds
 * the values onto the Workers, which then see them as bindings. That is why
 * they are absent from `./web`, and why validating them there would fail every
 * build.
 *
 * The reason this file exists at all is that the alternative failed silently.
 * `alchemy.run.ts` read raw `process.env` with `?? ""` fallbacks, so a typo in
 * LISTMONK_LIST_ID — or a repository variable that was never set — bound an
 * unusable value, `readListmonkConfig` returned null at the edge, the signup
 * route answered 503 and the hourly reconciler no-opped, all while the deploy
 * reported success. A live waitlist stops taking signups and nothing says so.
 *
 * So: everything is required, and the shapes are checked rather than merely
 * the presence of a string. A deploy that cannot serve the waitlist now fails
 * on the deploying machine, before anything is uploaded.
 */

/**
 * `"true"` means true and everything else means false, matching what the
 * call sites did by hand. Absent is false, so an unset flag keeps the
 * conservative default (no custom domain, no public workers.dev URL).
 */
const flag = z
  .string()
  .optional()
  .transform((value) => value === "true");

/**
 * Required, present, and not blank.
 *
 * The message is attached to both the type check and the length check because
 * zod reports them separately: without the first, an unset variable reads as
 * "expected string, received undefined", which is true and unhelpful to
 * whoever is looking at a failed deploy log.
 */
const required = (name: string) => {
  const message = `${name} is required and must not be empty`;
  return z.string(message).min(1, message);
};

export const deployEnvSchema = z.object({
  /** Encrypts `alchemy.secret(...)` values at rest. Serializing fails without it. */
  ALCHEMY_PASSWORD: required("ALCHEMY_PASSWORD"),
  /** Auth for the shared account-wide `alchemy-state` store worker. */
  ALCHEMY_STATE_TOKEN: required("ALCHEMY_STATE_TOKEN"),

  /** Server half of the Turnstile pair. The site key is a build-time client var. */
  TURNSTILE_SECRET_KEY: required("TURNSTILE_SECRET_KEY"),

  /**
   * listmonk. All four are required together: a partial set is precisely the
   * half-open waitlist this schema exists to prevent.
   *
   * The base URL is parsed as a URL rather than checked for length, because
   * `readListmonkConfig` only strips trailing slashes — anything else wrong
   * with it surfaces as a fetch failure per signup, not at deploy.
   */
  LISTMONK_BASE_URL: z
    .string("LISTMONK_BASE_URL is required and must not be empty")
    .url("LISTMONK_BASE_URL must be an absolute URL"),
  LISTMONK_API_USER: required("LISTMONK_API_USER"),
  LISTMONK_API_TOKEN: required("LISTMONK_API_TOKEN"),
  /**
   * The list id, which is 3 in production. This is the value the audit was
   * actually about: nothing checked it, so a typo bound something
   * `readListmonkConfig` rejects, and it was only ever rejected at the edge,
   * once per request, long after the deploy said it had worked.
   *
   * Matched as digits rather than run through `Number`, because coercion is
   * too generous to be a check here: `Number("")` is 0, `Number(" 3 ")` is 3,
   * and `Number("3e2")` is 300. A list id is typed by a human from the
   * listmonk UI and is always plain digits.
   */
  LISTMONK_LIST_ID: z
    .string("LISTMONK_LIST_ID is required and must not be empty")
    .regex(/^[1-9]\d*$/, "LISTMONK_LIST_ID must be a positive whole number")
    .transform(Number),

  /** Whether conpaws.com and www point at this Worker. */
  ROUTES_ENABLED: flag,
  /** Whether a stable `*.workers.dev` URL is served. Off by default: it is an indexable copy of the site. */
  WORKERS_DEV_ENABLED: flag,
  /** Whether per-version preview subdomains are served. */
  PREVIEW_URLS_ENABLED: flag,
});

export type DeployEnv = z.infer<typeof deployEnvSchema>;

/**
 * Parses the deploy environment, or throws with every problem listed at once.
 *
 * One aggregated message rather than zod's default report: a deploy is often
 * run from CI where the operator sees one line of log and cannot iterate, so
 * fixing four missing variables should take one run, not four.
 */
export function readDeployEnv(source: Record<string, string | undefined>) {
  const result = deployEnvSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Deploy environment is not usable, so nothing was deployed:\n${problems}\n\n` +
      "Locally these come from packages/infra/.env and apps/web/.env; in CI " +
      "they are repository secrets and variables (.github/workflows/deploy-web.yml).",
  );
}

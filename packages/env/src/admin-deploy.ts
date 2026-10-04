import { z } from "zod";

const required = (name: string) =>
  z.string(`${name} is required`).trim().min(1, `${name} is required`);

export const adminDeployEnvSchema = z.object({
  ALCHEMY_PASSWORD: required("ALCHEMY_PASSWORD"),
  ALCHEMY_STATE_TOKEN: required("ALCHEMY_STATE_TOKEN"),
  ADMIN_OWNER_EMAIL: z
    .email("ADMIN_OWNER_EMAIL must be a valid email address")
    .transform((value) => value.trim().toLowerCase()),
  CF_ACCESS_TEAM_DOMAIN: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i,
      "CF_ACCESS_TEAM_DOMAIN must be a host name without a scheme or path",
    ),
  CF_ACCESS_AUD: required("CF_ACCESS_AUD"),
  ADMIN_ROUTES_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export type AdminDeployEnv = z.infer<typeof adminDeployEnvSchema>;

export function readAdminDeployEnv(source: Record<string, string | undefined>) {
  const result = adminDeployEnvSchema.safeParse(source);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Admin deployment is not configured, so nothing was deployed:\n${problems}\n\n` +
      "Set admin variables in packages/infra/.env locally or in the protected GitHub deployment environment.",
  );
}

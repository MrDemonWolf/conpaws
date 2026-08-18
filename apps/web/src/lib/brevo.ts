const DOI_ENDPOINT =
  "https://api.brevo.com/v3/contacts/doubleOptinConfirmation";

export type BrevoConfig = {
  apiKey: string;
  listId: number;
  templateId: number;
  redirectionUrl: string;
};

type BrevoEnv = {
  BREVO_API_KEY?: string;
  BREVO_LIST_ID?: string;
  BREVO_DOI_TEMPLATE_ID?: string;
  BREVO_DOI_REDIRECT_URL?: string;
};

/**
 * Reads the Brevo configuration, or returns null if any part is missing.
 *
 * Null is the signal that the waitlist is not open yet — callers fail closed
 * on it rather than pretending a signup was accepted.
 */
export function readBrevoConfig(env: BrevoEnv): BrevoConfig | null {
  const apiKey = env.BREVO_API_KEY;
  const listId = Number(env.BREVO_LIST_ID);
  const templateId = Number(env.BREVO_DOI_TEMPLATE_ID);
  const redirectionUrl = env.BREVO_DOI_REDIRECT_URL;

  if (!apiKey || !redirectionUrl) return null;
  if (!Number.isInteger(listId) || !Number.isInteger(templateId)) return null;

  return { apiKey, listId, templateId, redirectionUrl };
}

export type BrevoResult =
  | { ok: true }
  | { ok: false; status: number; detail: string };

/**
 * Asks Brevo to send its double-opt-in confirmation email.
 *
 * Brevo owns the token, its expiry, and the confirmation click — this is the
 * whole reason the local schema has no `confirm_token` column. A 2xx here means
 * "Brevo accepted the contact and will send the email", not "the person
 * confirmed".
 */
export async function sendDoubleOptIn(
  config: BrevoConfig,
  contact: { email: string; name: string },
): Promise<BrevoResult> {
  let response: Response;

  try {
    response = await fetch(DOI_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        email: contact.email,
        attributes: contact.name ? { FIRSTNAME: contact.name } : undefined,
        includeListIds: [config.listId],
        templateId: config.templateId,
        redirectionUrl: config.redirectionUrl,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: error instanceof Error ? error.message : "network error",
    };
  }

  if (response.ok) return { ok: true };

  // Body is read for the stored sync_error so a stuck row can be diagnosed
  // without going to the logs. It is capped because it lands in a D1 column.
  const detail = (await response.text().catch(() => "")).slice(0, 500);
  return { ok: false, status: response.status, detail };
}

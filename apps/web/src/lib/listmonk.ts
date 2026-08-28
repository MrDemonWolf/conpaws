export type ListmonkConfig = {
  baseUrl: string;
  apiUser: string;
  apiToken: string;
  listId: number;
};

type ListmonkEnv = {
  LISTMONK_BASE_URL?: string;
  LISTMONK_API_USER?: string;
  LISTMONK_API_TOKEN?: string;
  LISTMONK_LIST_ID?: string;
};

/** Outbound calls are capped so a stalled ESP cannot hold a Worker open. */
const TIMEOUT_MS = 10_000;

/**
 * Reads the listmonk configuration, or returns null if any part is missing.
 *
 * Null is the signal that the waitlist is not open yet — callers fail closed
 * on it rather than pretending a signup was accepted.
 */
export function readListmonkConfig(env: ListmonkEnv): ListmonkConfig | null {
  const baseUrl = env.LISTMONK_BASE_URL?.replace(/\/+$/, "");
  const apiUser = env.LISTMONK_API_USER;
  const apiToken = env.LISTMONK_API_TOKEN;
  const listId = Number(env.LISTMONK_LIST_ID);

  if (!baseUrl || !apiUser || !apiToken) return null;
  if (!Number.isInteger(listId) || listId <= 0) return null;

  return { baseUrl, apiUser, apiToken, listId };
}

export type ListmonkResult =
  | { ok: true }
  | { ok: false; status: number; detail: string };

function headers(config: ListmonkConfig): HeadersInit {
  return {
    // listmonk accepts BasicAuth or this token form; the token form keeps the
    // credential out of a URL-encoded userinfo component.
    authorization: `token ${config.apiUser}:${config.apiToken}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

async function readDetail(response: Response): Promise<string> {
  // Body is read for the stored sync_error so a stuck row can be diagnosed
  // without going to the logs. It is capped because it lands in a D1 column.
  return (await response.text().catch(() => "")).slice(0, 500);
}

/**
 * How many people have confirmed their double opt-in.
 *
 * listmonk is the only place that knows this. The local `waitlist.status`
 * column has a `confirmed` value and a `confirmed_at` timestamp, but nothing
 * ever writes them — listmonk owns the confirmation click and offers no
 * callback — so counting D1 would report 0 forever.
 *
 * Reads `subscriber_statuses.confirmed` rather than `subscriber_count`: the
 * latter is a cached total that includes unconfirmed and recently deleted
 * subscribers, and was observed reporting 12 for a list holding 6 people.
 *
 * Returns null on any failure. Callers must treat that as "unknown" and show
 * something honest, never zero — a confirmed count of 0 and a broken API call
 * are very different claims to put on a page.
 */
export async function fetchConfirmedCount(
  config: ListmonkConfig,
): Promise<number | null> {
  try {
    const response = await fetch(
      `${config.baseUrl}/api/lists/${config.listId}`,
      { headers: headers(config), signal: AbortSignal.timeout(TIMEOUT_MS) },
    );

    if (!response.ok) return null;

    const body = (await response.json().catch(() => null)) as {
      data?: { subscriber_statuses?: { confirmed?: number } };
    } | null;

    const count = body?.data?.subscriber_statuses?.confirmed;
    return typeof count === "number" && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

/**
 * Adds the address to the waitlist list and gets listmonk to send its
 * double-opt-in confirmation email.
 *
 * Creating the subscriber is enough on its own: with `preconfirm_subscriptions`
 * false, listmonk's own InsertSubscriber sends the opt-in confirmation for any
 * double opt-in list the subscriber was added to. There is no second call to
 * make on the happy path, and adding one would send a duplicate email.
 *
 * listmonk owns the token, its expiry, and the confirmation click — this is the
 * whole reason the local schema has no `confirm_token` column. A 2xx here means
 * "listmonk accepted the subscriber and will send the email", not "the person
 * confirmed".
 *
 * Requires listmonk's "send opt-in confirmation" setting to be on, and the
 * target list to be double opt-in. Both are true for list 3.
 */
export async function sendDoubleOptIn(
  config: ListmonkConfig,
  contact: { email: string; name: string },
): Promise<ListmonkResult> {
  let response: Response;

  try {
    response = await fetch(`${config.baseUrl}/api/subscribers`, {
      method: "POST",
      headers: headers(config),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        email: contact.email,
        // Blank is fine: listmonk derives a display name from the address.
        name: contact.name,
        status: "enabled",
        lists: [config.listId],
        preconfirm_subscriptions: false,
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

  // 409 is "listmonk already has this address", which is success for our
  // purposes: the only way to get here is a create that already happened, and
  // that create is what sent the opt-in email. The six subscribers imported
  // from the old WordPress waitlist hit this the moment they use the form
  // again. Reporting it as a failure would retry them hourly to the attempt
  // ceiling and leave a permanent sync_error on a row that is perfectly fine.
  //
  // The tempting alternative — look the subscriber up and re-send the opt-in —
  // is deliberately not implemented. listmonk has no lookup-by-email route, so
  // it would go through the `query=` SQL expression parameter, and that needs
  // the `subscribers:sql_query` permission: arbitrary read SQL that supersedes
  // every list and subscriber permission. This token lives in a Worker at the
  // edge. A nudge email is not worth putting that in it.
  if (response.status === 409) return { ok: true };

  return {
    ok: false,
    status: response.status,
    detail: await readDetail(response),
  };
}

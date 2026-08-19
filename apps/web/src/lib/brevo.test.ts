import { afterEach, describe, expect, it, vi } from "vitest";

import { readBrevoConfig, sendDoubleOptIn } from "./brevo";

const CONFIG = {
  apiKey: "key",
  listId: 4,
  templateId: 9,
  redirectionUrl: "https://conpaws.com/confirmed",
};

const COMPLETE_ENV = {
  BREVO_API_KEY: "key",
  BREVO_LIST_ID: "4",
  BREVO_DOI_TEMPLATE_ID: "9",
  BREVO_DOI_REDIRECT_URL: "https://conpaws.com/confirmed",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readBrevoConfig", () => {
  it("reads a complete configuration", () => {
    expect(readBrevoConfig(COMPLETE_ENV)).toEqual(CONFIG);
  });

  it("returns null when any part is missing", () => {
    for (const key of Object.keys(COMPLETE_ENV)) {
      const partial = { ...COMPLETE_ENV, [key]: undefined };
      expect(readBrevoConfig(partial)).toBeNull();
    }
  });

  it("returns null when an id is not a number", () => {
    expect(
      readBrevoConfig({ ...COMPLETE_ENV, BREVO_LIST_ID: "not-a-number" }),
    ).toBeNull();
  });
});

describe("sendDoubleOptIn", () => {
  it("posts the contact to the double opt-in endpoint", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      sendDoubleOptIn(CONFIG, { email: "person@example.com", name: "Paws" }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.brevo.com/v3/contacts/doubleOptinConfirmation",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      email: "person@example.com",
      attributes: { FIRSTNAME: "Paws" },
      includeListIds: [4],
      templateId: 9,
      redirectionUrl: "https://conpaws.com/confirmed",
    });
  });

  it("reports a rejection with its status and body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("blocklisted", { status: 400 }),
    );

    await expect(
      sendDoubleOptIn(CONFIG, { email: "person@example.com", name: "" }),
    ).resolves.toEqual({ ok: false, status: 400, detail: "blocklisted" });
  });

  it("reports a network failure rather than throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await sendDoubleOptIn(CONFIG, {
      email: "person@example.com",
      name: "",
    });

    expect(result).toEqual({ ok: false, status: 0, detail: "network down" });
  });
});

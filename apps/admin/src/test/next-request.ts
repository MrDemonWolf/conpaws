/**
 * Just enough of a Next.js request for server-action tests: a cookie jar that
 * behaves like a browser (a Max-Age=0 cookie is gone), request headers, and
 * a Worker context whose waitUntil work the test can wait for.
 */
import { vi } from "vitest";

export interface CookieWrite {
  value: string;
  options: Record<string, unknown>;
}

export function createRequestState() {
  const jar = new Map<string, string>();
  const writes = new Map<string, CookieWrite>();
  const pending: Promise<unknown>[] = [];
  const state = {
    env: {} as Record<string, unknown>,
    headers: new Headers({ "cf-connecting-ip": "203.0.113.7" }),
    jar,
    writes,
    pending,
    cookies: {
      get: (name: string) =>
        jar.has(name) ? { name, value: jar.get(name) as string } : undefined,
      set: (name: string, value: string, options: Record<string, unknown>) => {
        writes.set(name, { value, options });
        if (options?.maxAge === 0 || value === "") jar.delete(name);
        else jar.set(name, value);
      },
      delete: (name: string) => {
        jar.delete(name);
      },
    },
    context: () => ({
      env: state.env,
      ctx: {
        waitUntil: (promise: Promise<unknown>) => {
          pending.push(promise);
        },
      },
    }),
    /** Waits for everything handed to waitUntil, like the Worker would. */
    settle: async () => {
      while (pending.length) await pending.shift();
    },
  };
  return state;
}

export type RequestState = ReturnType<typeof createRequestState>;

/** Runs a server action and returns where it redirected. */
export async function redirectOf(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("NEXT_REDIRECT:")) {
      return message.slice("NEXT_REDIRECT:".length);
    }
    throw error;
  }
  throw new Error("Expected the action to redirect.");
}

export const redirectMock = vi.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

export function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

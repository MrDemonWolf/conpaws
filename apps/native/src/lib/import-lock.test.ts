import { describe, expect, it } from "vitest";
import { runImportOnce } from "./import-lock";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runImportOnce", () => {
  it("drops a second tap that lands while the first import is running", async () => {
    const lock = { current: false };
    const write = deferred<boolean>();
    let runs = 0;
    const attempt = () => {
      runs += 1;
      return write.promise;
    };

    const first = runImportOnce(lock, attempt);
    const second = runImportOnce(lock, attempt);
    write.resolve(true);

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
    expect(runs).toBe(1);
  });

  it("drops a tap queued behind an import that already landed", async () => {
    // The queued tap runs the closure React last committed, whose preview is
    // still set, so freeing the lock on success would write it a second time.
    const lock = { current: false };
    let runs = 0;
    const attempt = async () => {
      runs += 1;
      return true;
    };

    await runImportOnce(lock, attempt);
    await expect(runImportOnce(lock, attempt)).resolves.toBe(false);
    expect(runs).toBe(1);
  });

  it("frees the lock when an attempt writes nothing, so it can be retried", async () => {
    const lock = { current: false };
    let runs = 0;
    const declined = async () => {
      runs += 1;
      return false;
    };

    await runImportOnce(lock, declined);
    await runImportOnce(lock, declined);
    expect(runs).toBe(2);
    expect(lock.current).toBe(false);
  });

  it("frees the lock when an attempt throws", async () => {
    const lock = { current: false };
    const failure = new Error("write failed");

    await expect(
      runImportOnce(lock, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(lock.current).toBe(false);
  });
});

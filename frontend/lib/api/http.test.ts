import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./http";

const response = (status: number) => new Response(null, { status });

describe("fetchWithRetry", () => {
  it("returns the first successful response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(200));

    const result = await fetchWithRetry("/questions", {}, { retries: 2 });

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries idempotent requests after a retryable response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));

    const result = await fetchWithRetry("/questions", {}, { retries: 1, retryDelayMs: 0 });

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-idempotent request by default", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(503));

    const result = await fetchWithRetry(
      "/answers",
      { method: "POST" },
      { retries: 2, retryDelayMs: 0 }
    );

    expect(result.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("enforces its timeout even when the caller supplies an abort signal", async () => {
    vi.useFakeTimers();
    const externalController = new AbortController();

    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
    );

    const request = fetchWithRetry(
      "/slow",
      { signal: externalController.signal },
      { retries: 0, timeoutMs: 50 }
    );
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(50);
    await rejection;
  });
});

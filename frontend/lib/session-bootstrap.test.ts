import { beforeEach, describe, expect, it, vi } from "vitest";
let bootstrap: typeof import("./session-bootstrap");

const state = vi.hoisted(() => ({ token: null as string | null, refresh: vi.fn() }));
vi.mock("./axios", () => ({
  getAccessToken: () => state.token,
  requestTokenRefresh: state.refresh,
}));

describe("early session restoration", () => {
  beforeEach(async () => {
    vi.resetModules();
    bootstrap = await import("./session-bootstrap");
    state.token = null;
    state.refresh.mockReset();
  });

  it.each(["restored-token", null])("shares the early cookie exchange, including a guest result: %s", async token => {
    state.refresh.mockResolvedValue(token);
    bootstrap.prepareSessionRestoration();
    bootstrap.prepareSessionRestoration();
    // Let the exchange settle before hydration starts.
    await Promise.resolve();
    await expect(bootstrap.restorePreparedSession()).resolves.toBe(token);
    bootstrap.prepareSessionRestoration();
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it("uses a current access token without refreshing", async () => {
    state.token = "current-token";
    bootstrap.prepareSessionRestoration();
    await expect(bootstrap.restorePreparedSession()).resolves.toBe("current-token");
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it("falls back to the normal exchange when no early request ran", async () => {
    state.refresh.mockResolvedValue("fallback-token");
    await expect(bootstrap.restorePreparedSession()).resolves.toBe("fallback-token");
    bootstrap.prepareSessionRestoration();
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it("discards a prepared result when authentication is cleared", async () => {
    state.refresh.mockResolvedValueOnce("old-token").mockResolvedValueOnce(null);
    bootstrap.prepareSessionRestoration();
    await Promise.resolve();
    bootstrap.discardPreparedSession();
    await expect(bootstrap.restorePreparedSession()).resolves.toBeNull();
    expect(state.refresh).toHaveBeenCalledTimes(2);
  });
});

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_TOKEN_CHANGED_EVENT,
  clearLegacyAuthStorage,
  getAccessToken,
  updateAccessToken,
} from "./axios";

describe("in-memory authentication token storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    updateAccessToken(null);
  });

  it("keeps the access token out of browser storage", () => {
    updateAccessToken("access-token");

    expect(getAccessToken()).toBe("access-token");
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("refreshToken")).toBeNull();
  });

  it("notifies subscribers when the in-memory token changes", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);

    updateAccessToken("new-token");

    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("new-token");
    window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
  });

  it("removes tokens left by older frontend versions", () => {
    window.localStorage.setItem("token", "legacy-access");
    window.localStorage.setItem("refreshToken", "legacy-refresh");

    clearLegacyAuthStorage();

    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("refreshToken")).toBeNull();
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios, { AxiosError } from "axios";
import api, { updateAccessToken } from "@/lib/axios";
import { useTranslation } from "./useTranslation";

const originalAdapter = api.defaults.adapter;
beforeEach(() => updateAccessToken("expired-token"));
afterEach(() => { api.defaults.adapter = originalAdapter; updateAccessToken(null); });

describe("useTranslation through the shared transport", () => {
  it("refreshes an expired token and retries translation once", async () => {
    const refresh = vi.spyOn(axios, "post").mockResolvedValue({ data: { token: "fresh-token" } });
    const adapter = vi.fn(async config => {
      const status = config.headers.Authorization === "Bearer fresh-token" ? 200 : 401;
      const response = { config, status, statusText: String(status), headers: {}, data: new TextEncoder().encode(JSON.stringify([{ translations: [{ text: "नमस्ते" }] }])).buffer };
      if (status === 401) throw new AxiosError("expired", "ERR_BAD_REQUEST", config, undefined, response);
      return response;
    });
    api.defaults.adapter = adapter;
    const { result } = renderHook(() => useTranslation());
    let translated: string[] = [];
    await act(async () => { translated = await result.current.translate(["Hello"], "hi"); });
    expect(translated).toEqual(["नमस्ते"]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it("falls back to source text when the session cannot be refreshed", async () => {
    const refresh = vi.spyOn(axios, "post").mockRejectedValue({ response: { status: 401 } });
    const adapter = vi.fn(async config => {
      throw new AxiosError("expired", "ERR_BAD_REQUEST", config, undefined, { config, status: 401, statusText: "Unauthorized", headers: {}, data: new ArrayBuffer(0) });
    });
    api.defaults.adapter = adapter;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useTranslation());
    let translated: string[] = [];
    await act(async () => { translated = await result.current.translate(["Hello"], "bn"); });
    expect(translated).toEqual(["Hello"]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

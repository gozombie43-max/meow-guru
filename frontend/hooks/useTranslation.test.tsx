import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranslation } from "./useTranslation";

const { getAccessTokenMock, requestTokenRefreshMock } = vi.hoisted(() => ({
  getAccessTokenMock: vi.fn(),
  requestTokenRefreshMock: vi.fn(),
}));

vi.mock("@/lib/axios", () => ({
  getAccessToken: getAccessTokenMock,
  requestTokenRefresh: requestTokenRefreshMock,
}));

describe("useTranslation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getAccessTokenMock.mockReset();
    requestTokenRefreshMock.mockReset();
  });

  it("refreshes an expired token and retries translation once", async () => {
    getAccessTokenMock.mockReturnValue("expired-token");
    requestTokenRefreshMock.mockResolvedValue("fresh-token");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(
        JSON.stringify([{ translations: [{ text: "नमस्ते" }] }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));
    const { result } = renderHook(() => useTranslation());

    let translated: string[] = [];
    await act(async () => {
      translated = await result.current.translate(["Hello"], "hi");
    });

    expect(translated).toEqual(["नमस्ते"]);
    expect(requestTokenRefreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    });
  });

  it("falls back to the source text when the session cannot be refreshed", async () => {
    getAccessTokenMock.mockReturnValue("expired-token");
    requestTokenRefreshMock.mockResolvedValue(null);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useTranslation());

    let translated: string[] = [];
    await act(async () => {
      translated = await result.current.translate(["Hello"], "bn");
    });

    expect(translated).toEqual(["Hello"]);
    expect(requestTokenRefreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

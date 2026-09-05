import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuizSession } from "./useQuizSession";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/http", () => ({ fetchWithRetry: fetchMock }));
const page = (id: string, cursor: string | null) => ({
  ok: true,
  json: async () => ({
    questions: [{ id }],
    nextCursor: cursor,
    hasMore: !!cursor,
  }),
});
function setup(topic = "algebra") {
  const cache = new Map();
  return renderHook(
    ({ topic }) => useQuizSession({ subject: "mathematics", topic }),
    {
      initialProps: { topic },
      wrapper: ({ children }) => (
        <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
      ),
    },
  );
}
describe("quiz cursor pages", () => {
  beforeEach(() => fetchMock.mockReset());
  it("requests 50 and appends one cursor page even with concurrent triggers", async () => {
    fetchMock
      .mockResolvedValueOnce(page("1", "cursor-1"))
      .mockResolvedValueOnce(page("2", null));
    const { result } = setup();
    await waitFor(() => expect(result.current.questions).toHaveLength(1));
    expect(fetchMock.mock.calls[0][0]).toContain("limit=50");
    await act(async () => {
      await Promise.all([
        result.current.fetchMore(),
        result.current.fetchMore(),
      ]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("cursor=cursor-1");
    expect(result.current.questions.map((q) => q.id)).toEqual(["1", "2"]);
    expect(result.current.hasMore).toBe(false);
  });
  it("isolates topic pages and restores cached cursors", async () => {
    fetchMock
      .mockResolvedValueOnce(page("a", "a-next"))
      .mockResolvedValueOnce(page("b", null));
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.questions[0]?.id).toBe("a"));
    rerender({ topic: "geometry" });
    await waitFor(() => expect(result.current.questions[0]?.id).toBe("b"));
    expect(result.current.hasMore).toBe(false);
    rerender({ topic: "algebra" });
    await waitFor(() => expect(result.current.nextCursor).toBe("a-next"));
    expect(result.current.questions.map((q) => q.id)).toEqual(["a"]);
  });
  it("retains loaded questions after a next-page failure without retry loops", async () => {
    fetchMock
      .mockResolvedValueOnce(page("a", "next"))
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => {
      await result.current.fetchMore();
    });
    await waitFor(() => expect(result.current.isError).toBeTruthy());
    expect(result.current.questions[0]?.id).toBe("a");
    await act(async () => {
      await result.current.fetchMore();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

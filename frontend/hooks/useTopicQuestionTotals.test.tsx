import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { expect, it, vi } from "vitest";
import { useTopicQuestionTotals } from "./useTopicQuestionTotals";
import { fetchWithRetry } from "@/lib/api/http";

vi.mock("@/lib/api/http", () => ({ fetchWithRetry: vi.fn() }));

it("shows saved totals while checking metadata, persists updates, and deduplicates revisits", async () => {
  const saved = { subject: "mathematics", revision: 1, totals: { percentages: 41 }, updatedAt: "2026-01-01" };
  localStorage.setItem("math-topic-counts:v1", JSON.stringify(saved));
  let resolve!: (value: Response) => void;
  vi.mocked(fetchWithRetry).mockReturnValue(new Promise<Response>(done => { resolve = done; }));
  const cache = new Map();
  const wrapper = ({ children }: { children: React.ReactNode }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>;
  const first = renderHook(() => useTopicQuestionTotals(), { wrapper });
  await waitFor(() => expect(first.result.current.data?.totals.percentages).toBe(41));
  const updated = { ...saved, revision: 2, totals: { percentages: 43 } };
  await act(async () => resolve(new Response(JSON.stringify(updated), { status: 200 })));
  await waitFor(() => expect(first.result.current.data?.totals.percentages).toBe(43));
  expect(JSON.parse(localStorage.getItem("math-topic-counts:v1")!).totals.percentages).toBe(43);
  first.unmount();
  const next = renderHook(() => useTopicQuestionTotals(), { wrapper });
  expect(next.result.current.data?.totals.percentages).toBe(43);
  expect(fetchWithRetry).toHaveBeenCalledTimes(1);
});

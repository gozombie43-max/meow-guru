import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTranslatedQuestion } from "./useTranslatedQuestion";
import { useTranslation } from "./useTranslation";

vi.mock("@/lib/axios", () => ({
  getAccessToken: () => "token",
  requestTokenRefresh: vi.fn(),
}));

vi.mock("@/shared/api/request", () => ({
  requestResponse: (url: string, options: RequestInit) => globalThis.fetch(url, options),
}));

const response = (texts: string[]) => new Response(JSON.stringify(
  texts.map((text) => ({ translations: [{ text: `bn:${text}` }] })),
));

afterEach(() => vi.restoreAllMocks());

describe("question translation navigation", () => {
  it("uses protected requests for coding questions and for their preloads", async () => {
    const first = { question: "In a code language, 'spin slow' is 'mm nn'.", options: ["IT", "ZZ", "mm", "nn"] };
    const next = { question: "In another code language, 'jump' is written as 'aB'.", options: ["aB", "Ab"] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) =>
      response(JSON.parse(init!.body as string).texts));
    const hook = renderHook(({ q, upcoming }) => useTranslatedQuestion(q, false, upcoming, "coding-decoding"), {
      initialProps: { q: first, upcoming: [next] },
    });
    act(() => hook.result.current.setActiveLang("bn"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(hook.result.current.displayedOptions).toEqual(first.options);
    expect(hook.result.current.displayedQuestion).toBe(`bn:${first.question}`);
    for (const [, init] of fetchMock.mock.calls) {
      const { texts } = JSON.parse(init!.body as string);
      expect(texts).toHaveLength(1);
      expect(texts[0]).toContain("QZXKEEP");
      expect(texts[0]).not.toContain("'mm nn'");
    }
    hook.rerender({ q: next, upcoming: [] });
    expect(hook.result.current.displayedQuestion).toBe(`bn:${next.question}`);
    expect(hook.result.current.displayedOptions).toEqual(["aB", "Ab"]);
    expect(hook.result.current.isTranslating).toBe(false);
  });

  it("preloads the next question and reuses translations after remounting", async () => {
    const first = { question: "Preload first?", options: ["Choice one"] };
    const next = { question: "Preload next?", options: ["Choice two"] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) =>
      response(JSON.parse(init!.body as string).texts));
    const hook = renderHook(({ q, upcoming }) => useTranslatedQuestion(q, false, upcoming), {
      initialProps: { q: first, upcoming: [next] },
    });
    act(() => hook.result.current.setActiveLang("bn"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => {});
    hook.rerender({ q: next, upcoming: [] });
    expect(hook.result.current.displayedQuestion).toBe("bn:Preload next?");
    expect(hook.result.current.isTranslating).toBe(false);
    hook.unmount();
    const remounted = renderHook(() => useTranslatedQuestion(next));
    act(() => remounted.result.current.setActiveLang("bn"));
    expect(remounted.result.current.displayedQuestion).toBe("bn:Preload next?");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("immediately shows the new source and ignores late responses", async () => {
    const resolvers: ((value: Response) => void)[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
    const hook = renderHook(({ question }) => useTranslatedQuestion({ question, options: [] }), {
      initialProps: { question: "Slow old question?" },
    });
    act(() => hook.result.current.setActiveLang("bn"));
    hook.rerender({ question: "Fast new question?" });
    expect(hook.result.current.displayedQuestion).toBe("Fast new question?");
    expect(hook.result.current.isTranslating).toBe(true);
    await act(async () => resolvers[1](response(["Fast new question?"])));
    expect(hook.result.current.displayedQuestion).toBe("bn:Fast new question?");
    await act(async () => resolvers[0](response(["Slow old question?"])));
    expect(hook.result.current.displayedQuestion).toBe("bn:Fast new question?");
    expect(hook.result.current.isTranslating).toBe(false);
  });

  it("shares in-flight requests and leaves letter codes and numbers unchanged", async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise((done) => { resolve = done; }));
    const hook = renderHook(() => useTranslation());
    await act(async () => {
      const first = hook.result.current.translate(["Deduplicate this?", "EVICED", "123", ""], "bn", true);
      const second = hook.result.current.translate(["Deduplicate this?"], "bn");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).texts).toEqual(["Deduplicate this?"]);
      resolve(response(["Deduplicate this?"]));
      expect(await first).toEqual(["bn:Deduplicate this?", "EVICED", "123", ""]);
      expect(await second).toEqual(["bn:Deduplicate this?"]);
    });
    expect(hook.result.current.isTranslating).toBe(false);
  });
});

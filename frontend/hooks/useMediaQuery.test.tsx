// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

describe("useMediaQuery", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("tracks media query changes and removes its listener", () => {
    let matches = false;
    let listener: (() => void) | undefined;
    const removeEventListener = vi.fn();

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) =>
        ({
          get matches() {
            return matches;
          },
          media: query,
          onchange: null,
          addEventListener: (
            _event: "change",
            callback: (event: MediaQueryListEvent) => void
          ) => {
            listener = callback as () => void;
          },
          removeEventListener,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList)
    );

    const { result, unmount } = renderHook(() =>
      useMediaQuery("(min-width: 1024px)")
    );

    expect(result.current).toBe(false);

    matches = true;
    act(() => listener?.());
    expect(result.current).toBe(true);

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});

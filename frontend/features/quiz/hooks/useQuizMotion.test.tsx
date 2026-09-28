import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useQuizMotion } from "./useQuizMotion";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("scores immediately and sequences selected, correct, then Next presentation", () => {
  const score = vi.fn();
  const { result } = renderHook(() => useQuizMotion(0, "Question"));
  act(() => result.current.submit(score));
  expect(score).toHaveBeenCalledTimes(1);
  expect(result.current.stage).toBe(0);
  act(() => vi.advanceTimersByTime(80));
  expect(result.current.stage).toBe(1);
  act(() => vi.advanceTimersByTime(80));
  expect(result.current.stage).toBe(2);
  act(() => vi.advanceTimersByTime(140));
  expect(result.current.stage).toBe(3);
});

it("ignores repeated Next presses and cancels stale navigation on a palette jump", () => {
  const next = vi.fn();
  const { result, rerender } = renderHook(({ id }) => useQuizMotion(id, "Question"), { initialProps: { id: 1 } });
  act(() => { result.current.next(next); result.current.next(next); });
  act(() => vi.advanceTimersByTime(150));
  expect(next).toHaveBeenCalledTimes(1);
  act(() => result.current.next(next));
  rerender({ id: 3 });
  act(() => vi.runAllTimers());
  expect(next).toHaveBeenCalledTimes(1);
});

it("skips delays for reduced motion and cancels pending work on unmount", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  const action = vi.fn();
  const { result, unmount } = renderHook(() => useQuizMotion(1, "Question"));
  act(() => { result.current.submit(action); result.current.next(action); });
  expect(result.current.stage).toBe(3);
  expect(action).toHaveBeenCalledTimes(2);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  act(() => result.current.next(action));
  unmount();
  act(() => vi.runAllTimers());
  expect(action).toHaveBeenCalledTimes(2);
});

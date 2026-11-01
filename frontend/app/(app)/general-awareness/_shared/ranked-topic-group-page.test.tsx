import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RankedTopicGroupPage from "./ranked-topic-group-page";
import { recordRecentChapter } from "@/lib/recent-study";
import { GENERAL_AWARENESS_TOPIC_GROUPS } from "@/lib/general-awareness-topic-groups";

const mockUseTopicQuestionTotals = vi.fn();

vi.mock("@/hooks/useTopicQuestionTotals", () => ({
  useTopicQuestionTotals: (subject?: string) => mockUseTopicQuestionTotals(subject),
}));

vi.mock("@/hooks/useAppNavigation", () => ({
  useBackLayer: vi.fn(),
}));

describe("RankedTopicGroupPage", () => {
  let desktop = false;
  let updateViewport: (() => void) | undefined;

  beforeEach(() => {
    desktop = false;
    localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        get matches() {
          return desktop;
        },
        media: query,
        onchange: null,
        addEventListener: (_event: string, listener: () => void) => {
          updateViewport = listener;
        },
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    mockUseTopicQuestionTotals.mockReturnValue({
      data: {
        totals: {
          "indian-rivers-drainage-system": 240,
          "physiography-of-india": 56,
        },
        userProgress: {
          "indian-rivers-drainage-system": { userSolved: 42, userMastered: 20 },
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    updateViewport = undefined;
  });

  it("renders short search placeholder without voice search mic button", () => {
    render(<RankedTopicGroupPage group={GENERAL_AWARENESS_TOPIC_GROUPS.geography} />);

    expect(screen.getAllByPlaceholderText("Search chapters")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /voice search/i })).toBeNull();

    act(() => {
      desktop = true;
      updateViewport?.();
    });

    expect(screen.getAllByPlaceholderText("Search chapters")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /voice search/i })).toBeNull();
  });

  it("displays attempted / total progress for chapters", () => {
    render(<RankedTopicGroupPage group={GENERAL_AWARENESS_TOPIC_GROUPS.geography} />);

    const riverLinks = screen.getAllByRole("link", { name: /Indian Rivers & Drainage System/i });
    expect(riverLinks).toHaveLength(1);
    expect(riverLinks[0].textContent).toContain("42/240 attempted");

    const physioLinks = screen.getAllByRole("link", { name: /Physiography of India/i });
    expect(physioLinks).toHaveLength(1);
    expect(physioLinks[0].textContent).toContain("0/56 attempted");

    act(() => {
      desktop = true;
      updateViewport?.();
    });

    const desktopRiverLinks = screen.getAllByRole("link", { name: /Indian Rivers & Drainage System/i });
    expect(desktopRiverLinks).toHaveLength(1);
    expect(desktopRiverLinks[0].textContent).toContain("42/240 attempted");

    const desktopPhysioLinks = screen.getAllByRole("link", { name: /Physiography of India/i });
    expect(desktopPhysioLinks).toHaveLength(1);
    expect(desktopPhysioLinks[0].textContent).toContain("0/56 attempted");
  });

  it("filters chapters by search query and clears cleanly without layout shift", () => {
    const { container } = render(
      <RankedTopicGroupPage group={GENERAL_AWARENESS_TOPIC_GROUPS.geography} />
    );

    const searchInput = container.querySelector('[data-mobile-chapter-search]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: "Physiography" } });
    expect(screen.getAllByRole("link", { name: /Physiography of India/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("link", { name: /Indian Rivers & Drainage System/i })).toBeNull();

    const clearBtn = screen.getByRole("button", { name: "Clear Search" });
    fireEvent.click(clearBtn);
    expect(searchInput.value).toBe("");
    expect(screen.getAllByRole("link", { name: /Indian Rivers & Drainage System/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("promotes the most recently practiced chapter to first position with a single Continue tag while keeping original rank", () => {
    recordRecentChapter("general-awareness", "geography", "physiography-of-india");
    const { container } = render(
      <RankedTopicGroupPage group={GENERAL_AWARENESS_TOPIC_GROUPS.geography} />
    );

    const mobileRows = container.querySelectorAll('[data-hub-part="mobileTopicRow"]');
    expect(mobileRows.length).toBeGreaterThan(1);
    const firstRow = mobileRows[0] as HTMLElement;
    expect(firstRow).toHaveAttribute("data-recent", "true");
    expect(firstRow).toHaveTextContent("Physiography of India");
    expect(within(firstRow).getByText("2")).toBeInTheDocument();
    expect(within(firstRow).getByText("Continue")).toBeInTheDocument();
    expect(within(firstRow).queryByText("Recently")).not.toBeInTheDocument();
  });
});

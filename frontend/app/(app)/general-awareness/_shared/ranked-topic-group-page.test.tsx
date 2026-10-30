import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    localStorage.clear();
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

  it("renders short search placeholder without voice search mic button", () => {
    render(<RankedTopicGroupPage group={GENERAL_AWARENESS_TOPIC_GROUPS.geography} />);

    const searchInputs = screen.getAllByPlaceholderText("Search chapters");
    expect(searchInputs.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("button", { name: /voice search/i })).toBeNull();
  });

  it("displays attempted / total progress for chapters", () => {
    render(<RankedTopicGroupPage group={GENERAL_AWARENESS_TOPIC_GROUPS.geography} />);

    const riverLinks = screen.getAllByRole("link", { name: /Indian Rivers & Drainage System/i });
    expect(riverLinks.length).toBeGreaterThanOrEqual(2);
    expect(riverLinks[0].textContent).toContain("42/240 attempted");

    const physioLinks = screen.getAllByRole("link", { name: /Physiography of India/i });
    expect(physioLinks[0].textContent).toContain("0/56 attempted");
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

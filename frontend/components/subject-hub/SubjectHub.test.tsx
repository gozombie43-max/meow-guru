import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SubjectHub from "./SubjectHub";
import { Calculator } from "lucide-react";
import {
  CATEGORIES,
  PRACTICE_MODES,
  PRIORITY_CONFIG,
  TOPICS,
} from "@/app/(app)/mathematics/topic-data";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

const linksRendered: { href: string; prefetch?: boolean }[] = [];
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
    [key: string]: unknown;
  }) => {
    linksRendered.push({ href, prefetch });
    return (
      <a href={href} data-prefetch={String(prefetch)} {...rest}>
        {children}
      </a>
    );
  },
}));

vi.mock("@/hooks/useQuestionCounts", () => ({
  useQuestionCounts: () => ({
    counts: {
      concept: 10,
      formula: 5,
      mixed: 8,
      "ai-challenge": 3,
      easy: 4,
      hard: 6,
      "study-mode": 2,
    },
    isLoading: false,
    isError: null,
    mutate: vi.fn(),
  }),
}));

const mockConfig = {
  subjectId: "mathematics",
  label: "Mathematics",
  icon: Calculator,
  topics: TOPICS,
  categories: CATEGORIES,
  priorityConfig: PRIORITY_CONFIG,
  practiceModes: PRACTICE_MODES,
  notesLabel: "Formula & Tricks Bank",
  searchPlaceholder: "Search math topics, formulas, rules... (⌘K)",
  mobileSearchPlaceholder: "Search math topics…",
};

describe("SubjectHub", () => {
  it("keeps all topics available with OLED filters, including the English Low group", () => {
    const topics = TOPICS.map((topic, index) => ({ ...topic, priority: index === 0 ? "low" : topic.priority }));
    const { container } = render(<SubjectHub config={{ ...mockConfig, topics, mobileAppearance: "oled", categories: [...CATEGORIES, { id: "low", label: "Low", icon: Calculator }] }} />);
    const filters = within(container.querySelector('[data-hub-part="mobileTabsScroll"]') as HTMLElement);
    expect(container.querySelectorAll('[data-hub-part="mobileTopicRow"]')).toHaveLength(topics.length);
    fireEvent.click(filters.getByRole("button", { name: "Low" }));
    expect(filters.getByRole("button", { name: "Low" })).toHaveAttribute("aria-pressed", "true");
    const rows = container.querySelectorAll('[data-hub-part="mobileTopicRow"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Percentages");
    expect(rows[0]).not.toHaveTextContent("Questions");
  });
  it("preserves chapter-group navigation when mobile priority filters are enabled", () => {
    const { container } = render(<SubjectHub config={{ ...mockConfig, mobileAppearance: "oled", getChapterGroup: () => null, chapterBasePrefix: "/general-awareness" }} />);
    const row = container.querySelector('[data-hub-part="mobileTopicRow"]');
    expect(row).toHaveAttribute("href", "/general-awareness/percentages");
    const filters = within(container.querySelector('[data-hub-part="mobileTabsScroll"]') as HTMLElement);
    fireEvent.click(filters.getByRole("button", { name: "High" }));
    expect(container.querySelectorAll('[data-hub-part="mobileTopicRow"]')).toHaveLength(TOPICS.filter(topic => topic.priority === "high").length);
  });
  it("renders topics and verifies all links have prefetch disabled", () => {
    linksRendered.length = 0;
    render(<SubjectHub config={mockConfig} />);

    // Mathematics topics should be rendered
    expect(screen.getAllByText("Percentages").length).toBeGreaterThanOrEqual(1);

    // Verify all rendered links have prefetch={false}
    expect(linksRendered.length).toBeGreaterThan(0);
    for (const link of linksRendered) {
      expect(link.prefetch).toBe(false);
    }
  });

  it("renders mobile topic rows with prefetch disabled", () => {
    const { container } = render(<SubjectHub config={mockConfig} />);
    const mobileLinks = container.querySelectorAll(
      '[data-hub-part="mobileTopicRow"]',
    );
    expect(mobileLinks.length).toBeGreaterThan(0);
    mobileLinks.forEach((link) => {
      expect(link.getAttribute("data-prefetch")).toBe("false");
    });
  });
});

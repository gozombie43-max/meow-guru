import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const countsQuery = vi.hoisted(() => vi.fn());
let desktop = false;
let updateViewport: (() => void) | undefined;
beforeEach(() => {
  desktop = false;
  countsQuery.mockClear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return desktop; },
    addEventListener: (_event: string, listener: () => void) => { updateViewport = listener; },
    removeEventListener: vi.fn(),
  })));
});
afterEach(() => { vi.unstubAllGlobals(); updateViewport = undefined; });

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
  useQuestionCounts: (params: unknown) => { countsQuery(params); return {
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
  }; },
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
  it('mounts only the active viewport and enables counts only for desktop', async () => {
    const { container } = render(<SubjectHub config={mockConfig} />);
    expect(container.querySelector('[class*="desktopContainer"]')).toBeNull();
    expect(countsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    act(() => { desktop = true; updateViewport?.(); });
    await waitFor(() => expect(container.querySelector('[class*="desktopContainer"]')).not.toBeNull());
    expect(container.querySelector('[data-hub-part="mobileTopbar"]')).toBeNull();
    expect(countsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
    act(() => { desktop = false; updateViewport?.(); });
    expect(container.querySelector('[class*="desktopContainer"]')).toBeNull();
    expect(container.querySelector('[data-hub-part="mobileTopbar"]')).not.toBeNull();
    expect(countsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });
  it("keeps all topics available with OLED filters, including the English Low group", () => {
    const topics = TOPICS.map((topic, index) => ({ ...topic, priority: index === 0 ? "low" : "high" }));
    const { container } = render(<SubjectHub config={{ ...mockConfig, topics, mobileAppearance: "oled", categories: [...CATEGORIES, { id: "low", label: "Low", icon: Calculator }] }} />);
    const filters = within(container.querySelector('[data-hub-part="mobileTabsScroll"]') as HTMLElement);
    expect(container.querySelectorAll('[data-hub-part="mobileTopicRow"]')).toHaveLength(topics.length);
    fireEvent.click(filters.getByRole("button", { name: "Low" }));
    expect(filters.getByRole("button", { name: "Low" })).toHaveAttribute("aria-pressed", "true");
    const rows = container.querySelectorAll('[data-hub-part="mobileTopicRow"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Percentages");
    expect(within(rows[0] as HTMLElement).getByText("0 Questions")).toBeInTheDocument();
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

  it("renders OLED cards without chevrons and displays zero question / solved counts", () => {
    const mobileTopicDetails = {
      percentages: { color: "#5DA6FF", questionCount: 705, userSolved: 0, progress: 0 },
      "simple-interest": { color: "#F3B54A", questionCount: 0 },
    };
    const { container } = render(
      <SubjectHub
        config={{
          ...mockConfig,
          mobileAppearance: "oled",
          mobileTopicDetails,
        }}
      />
    );

    // Verify topic titles
    expect(screen.getAllByText("Percentages").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Simple Interest").length).toBeGreaterThanOrEqual(1);

    // Keep nonempty totals and explicit zero counts on their respective cards.
    expect(screen.getByText("0 / 705 solved")).toBeInTheDocument();
    const emptyTopic = screen.getByRole("link", { name: "Simple Interest, 0 questions" });
    expect(within(emptyTopic).getByText("0 Questions")).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();

    // Mobile cards omit progress percentages.
    container.querySelectorAll('[data-hub-part="mobileTopicRow"]').forEach((card) => {
      expect(card).not.toHaveTextContent(/\d+%/);
      expect(card.querySelector('[class*="progress"]')).toBeNull();
    });

    // Verify NO chevrons exist in mobile topic rows
    const rows = container.querySelectorAll('[data-hub-part="mobileTopicRow"]');
    rows.forEach((row) => {
      expect(row.querySelector('svg.lucide-chevron-right')).toBeNull();
    });
  });
});


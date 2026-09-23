import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlaySetupPage from "./page";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
}));

const routeState = vi.hoisted(() => ({
  params: { mode: "nightmare" },
  searchParams: new URLSearchParams("exam=ssc-cgl"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useParams: () => routeState.params,
  useSearchParams: () => routeState.searchParams,
}));

const mockCapabilities = {
  exams: [
    { id: "ssc-cgl", label: "SSC CGL" },
    { id: "ssc-chsl", label: "SSC CHSL" },
    { id: "cat", label: "CAT" },
  ],
  modes: {
    nightmare: {
      id: "nightmare",
      navigation: "forward",
      confidence: false,
      sectional: false,
      requiresSubject: false,
      supportsFullSection: false,
      supportsTier: true,
      clock: "target",
      clockMultiplier: 1.0,
      minuteOptions: [],
      minDifficulty: 3,
      lives: null,
    },
    sprint: {
      id: "sprint",
      navigation: "forward",
      confidence: true,
      sectional: false,
      requiresSubject: false,
      supportsFullSection: false,
      supportsTier: false,
      clock: "fixed",
      clockMultiplier: 1.0,
      minuteOptions: [5, 10, 15],
      minDifficulty: 1,
      lives: null,
    },
    section: {
      id: "section",
      navigation: "free",
      confidence: true,
      sectional: true,
      requiresSubject: true,
      supportsFullSection: true,
      supportsTier: true,
      clock: "target",
      clockMultiplier: 1.0,
      minuteOptions: [],
      minDifficulty: 1,
      lives: null,
    },
  },
};

const mockDashboard = {
  readiness: 75,
  evidenceConfidence: "medium" as const,
  confidenceScore: 70,
  attempts: 42,
  evidence: "Solid progress",
  factors: {},
  topics: [],
  reviews: [],
  due: [],
  subjects: ["Mathematics", "English", "General Intelligence"],
  catalogTopics: ["Arithmetic", "Algebra", "Grammar", "Analogies"],
  catalog: [
    { subject: "Mathematics", topic: "Arithmetic" },
    { subject: "Mathematics", topic: "Algebra" },
    { subject: "English", topic: "Grammar" },
    { subject: "General Intelligence", topic: "Analogies" },
  ],
  active: [],
  history: [],
  mission: [],
  personalBest: 15,
};

vi.mock("../../hooks/useTrainingCapabilities", () => ({
  useTrainingCapabilities: () => ({
    capabilities: mockCapabilities,
    loading: false,
    error: "",
  }),
}));

vi.mock("../../hooks/useTrainingDashboard", () => ({
  useTrainingDashboard: () => ({
    dashboard: mockDashboard,
    loading: false,
    error: "",
  }),
}));

const postMock = vi.fn();
vi.mock("@/shared/api/client", () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
  },
}));

describe("Start Session Setup Page (/play/setup/[mode])", () => {
  beforeEach(() => {
    routeState.params = { mode: "nightmare" };
    routeState.searchParams = new URLSearchParams("exam=ssc-cgl");
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("renders page header with back button and Start Session title", () => {
    render(<PlaySetupPage />);
    expect(screen.getByRole("heading", { name: "Start Session" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Play" })).toHaveAttribute("href", "/play");
  });

  it("renders selected mode hero card with category badge, title, and description", () => {
    render(<PlaySetupPage />);
    expect(screen.getByRole("heading", { name: "AI Nightmare" })).toBeInTheDocument();
    expect(screen.getByText("Extreme")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Only hard or higher bank questions qualify. Generated variants require prior validation."
      )
    ).toBeInTheDocument();
  });

  it("renders interactive configuration fields and official scoring card", () => {
    render(<PlaySetupPage />);
    expect(screen.getByRole("heading", { name: "Session Setup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Exam / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tier / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Subject / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Topic / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Questions / })).toBeInTheDocument();

    // Official scoring card
    expect(screen.getByText(/Official SSC CGL Tier I Scoring:/i)).toBeInTheDocument();
    expect(screen.getByText("+2 correct")).toBeInTheDocument();
    expect(screen.getByText("−0.5 wrong")).toBeInTheDocument();
    expect(screen.getByText("0 skip")).toBeInTheDocument();
  });

  it("renders live session summary with mode, exam, tier, subject, topic, questions", () => {
    render(<PlaySetupPage />);
    expect(screen.getByRole("heading", { name: "Session Summary" })).toBeInTheDocument();
    const summarySection = screen.getByLabelText("Session parameters breakdown");
    expect(summarySection).toHaveTextContent("AI Nightmare");
    expect(summarySection).toHaveTextContent("SSC CGL");
    expect(summarySection).toHaveTextContent("Tier I (+2/−0.5)");
    expect(summarySection).toHaveTextContent("All subjects");
    expect(summarySection).toHaveTextContent("Balanced mix");
    expect(summarySection).toHaveTextContent("20 questions");
  });

  it("creates session on Begin training click and routes to /play/session/[id]", async () => {
    postMock.mockResolvedValueOnce({ data: { id: "session-12345" } });
    render(<PlaySetupPage />);

    const beginBtn = screen.getByRole("button", { name: /Begin training/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/training/sessions", {
        mode: "nightmare",
        exam: "ssc-cgl",
        tier: "1",
        subject: undefined,
        topic: undefined,
        count: 20,
        minutes: 10,
      });
      expect(routerMock.push).toHaveBeenCalledWith("/play/session/session-12345");
    });
  });

  it("renders clock selector for fixed-time modes like sprint", () => {
    routeState.params = { mode: "sprint" };
    render(<PlaySetupPage />);
    expect(screen.getByRole("heading", { name: "Sprint" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Time / })).toBeInTheDocument();
  });

  it("disables Begin training button when required subject is missing for sectional mode", () => {
    routeState.params = { mode: "section" };
    render(<PlaySetupPage />);
    const beginBtn = screen.getByRole("button", { name: /Begin training/i });
    expect(beginBtn).toBeDisabled();
  });
});

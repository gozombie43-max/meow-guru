import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlayPage from "./page";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

const searchParamsMock = vi.hoisted(() => new URLSearchParams(""));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock,
}));

vi.mock("./hooks/useTrainingCapabilities", () => ({
  useTrainingCapabilities: () => ({
    capabilities: {
      exams: [
        { id: "ssc-cgl", label: "SSC CGL" },
        { id: "ssc-chsl", label: "SSC CHSL" },
        { id: "cat", label: "CAT" },
      ],
    },
    error: "",
  }),
}));

vi.mock("./hooks/useTrainingDashboard", () => ({
  useTrainingDashboard: () => ({
    dashboard: {
      readiness: 80,
      attempts: 50,
      personalBest: 10,
      due: [],
      active: [],
      topics: [],
    },
    loading: false,
    error: "",
    setDashboard: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
  }),
}));

vi.mock("./hooks/useTrainingSetup", () => ({
  useTrainingSetup: () => ({
    busy: false,
    error: "",
    setError: vi.fn(),
    start: vi.fn(),
  }),
}));

describe("PlayPage Hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the main play hub heading and mode cards immediately", () => {
    render(<PlayPage />);
    expect(screen.getByRole("heading", { name: "Choose your training." })).toBeInTheDocument();
    expect(screen.getByText("Training modes")).toBeInTheDocument();
    expect(screen.getByText("MEOW GURU / TRAINING STUDIO")).toBeInTheDocument();
  });

  it("renders the navigation tabs", () => {
    render(<PlayPage />);
    const trainMeButtons = screen.getAllByRole("button", { name: /Train Me/i });
    expect(trainMeButtons.length).toBeGreaterThan(0);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
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
    Element.prototype.scrollTo = vi.fn();
    for (const key of [...searchParamsMock.keys()]) searchParamsMock.delete(key);
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

  it("uses the selected exam when a server-rendered mode card is activated", () => {
    searchParamsMock.set("exam", "cat");
    render(<PlayPage />);
    fireEvent.click(screen.getByRole("button", { name: "Set up Adaptive" }));
    expect(routerMock.push).toHaveBeenCalledWith("/play/setup/adaptive?exam=cat");
  });

  it("preserves URL-backed tab navigation and unrelated parameters", () => {
    searchParamsMock.set("exam", "ssc-chsl");
    searchParamsMock.set("source", "saved");
    render(<PlayPage />);
    fireEvent.click(screen.getAllByRole("button", { name: /Train Me/i })[0]);
    expect(screen.getByRole("heading", { name: "Your daily mission." })).toBeInTheDocument();
    const query = new URL(routerMock.push.mock.calls[0][0], "http://localhost").searchParams;
    expect(query.get("exam")).toBe("ssc-chsl");
    expect(query.get("view")).toBe("mission");
    expect(query.get("source")).toBe("saved");
  });
});

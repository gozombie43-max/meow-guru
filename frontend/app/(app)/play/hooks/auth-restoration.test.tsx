import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrainingCapabilities } from "./useTrainingCapabilities";
import { useTrainingDashboard } from "./useTrainingDashboard";
import TrainingMockCatalog from "@/components/training/TrainingMockCatalog";

const state = vi.hoisted(() => ({
  auth: { loading: true, token: null as string | null },
  get: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/shared/api/client", () => ({ default: { get: state.get } }));

function HubQueries() {
  useTrainingCapabilities();
  useTrainingDashboard("ssc-cgl");
  return <TrainingMockCatalog exam="ssc-cgl" />;
}

describe("public training hub request boundary", () => {
  beforeEach(() => {
    state.auth = { loading: true, token: null };
    state.get.mockReset().mockResolvedValue({ data: {} });
  });

  it("waits for verified session restoration even when the token arrives first", async () => {
    const view = render(<HubQueries />);
    expect(screen.getByRole("heading", { name: "Previous-year papers" })).toBeInTheDocument();
    expect(state.get).not.toHaveBeenCalled();
    state.auth = { loading: true, token: "restored-token" };
    view.rerender(<HubQueries />);
    expect(state.get).not.toHaveBeenCalled();
    state.auth.loading = false;
    view.rerender(<HubQueries />);
    await waitFor(() => expect(state.get).toHaveBeenCalledTimes(4));
    expect(state.get.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      "/api/training/capabilities", "/api/training/dashboard",
      "/api/mocktest/ssc-cgl/slots", "/api/mocktest/ssc-cgl/history",
    ]));
  });

  it("does not fetch private data after an unauthenticated restoration", () => {
    state.auth.loading = false;
    render(<HubQueries />);
    expect(state.get).not.toHaveBeenCalled();
  });
});

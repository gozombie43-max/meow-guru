import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockPyqPage from "./page";
import { requestResponse } from "@/shared/api/request";

const state = vi.hoisted(() => ({ mode: "ssc" }));
vi.mock("@/context/ExamModeContext", () => ({ useExamMode: () => ({ mode: state.mode }) }));
vi.mock("@/shared/api/request", () => ({ requestResponse: vi.fn() }));
const papers = [
  { id: "mock-1", examSlug: "ssc-cgl", title: "CGL Mock One", type: "mock", isFree: true, order: 1 },
  { id: "pyq-1", examSlug: "ssc-chsl", title: "CHSL Official Paper", type: "pyq", year: 2024, shift: "Morning", isFree: false },
  { id: "jam-1", examSlug: "iit-jam-physics", title: "JAM Paper", type: "pyq", year: 2025 },
];
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

beforeEach(() => { state.mode = "ssc"; vi.mocked(requestResponse).mockReset().mockImplementation(async () => response({ slots: papers })); });
afterEach(cleanup);

describe("Mock & Pyq management", () => {
  it("combines filters and clears them without exposing the other exam mode", async () => {
    render(<MockPyqPage />);
    await screen.findByText("CGL Mock One");
    expect(screen.queryByText("JAM Paper")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Paper type"), { target: { value: "pyq" } });
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2024" } });
    fireEvent.change(screen.getByLabelText("Access"), { target: { value: "pro" } });
    expect(screen.getByText("CHSL Official Paper")).toBeInTheDocument();
    expect(screen.queryByText("CGL Mock One")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "missing" } });
    expect(screen.getByText("No papers match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("CGL Mock One")).toBeInTheDocument();
  });

  it("saves details through the scoped PATCH endpoint and updates the list", async () => {
    render(<MockPyqPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit CGL Mock One" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated Mock" } });
    fireEvent.click(screen.getByLabelText("Free access"));
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ success: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Paper details saved.");
    expect(screen.getByText("Updated Mock")).toBeInTheDocument();
    const [url, options] = vi.mocked(requestResponse).mock.calls[1];
    expect(url).toContain("/admin/slots/mock-1?examMode=ssc");
    expect(options?.method).toBe("PATCH");
    expect(JSON.parse(String(options?.body))).toMatchObject({ examSlug: "ssc-cgl", title: "Updated Mock", isFree: false });
    expect(screen.queryByRole("form", { name: "Edit paper" })).not.toBeInTheDocument();
  });

  it("keeps the draft when saving fails", async () => {
    render(<MockPyqPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit CGL Mock One" }));
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ error: "Save unavailable" }, 500));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save unavailable");
    expect(screen.getByLabelText("Title")).toHaveValue("CGL Mock One");
  });

  it("resets drafts and filters and reloads in the newly selected mode", async () => {
    const view = render(<MockPyqPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit CGL Mock One" }));
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "CGL" } });
    state.mode = "iit-jam";
    view.rerender(<MockPyqPage />);
    await screen.findByText("JAM Paper");
    expect(screen.getByLabelText("Search")).toHaveValue("");
    expect(screen.queryByRole("form", { name: "Edit paper" })).not.toBeInTheDocument();
    expect(screen.queryByText("CGL Mock One")).not.toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(requestResponse).mock.calls.at(-1)?.[0]).toContain("examMode=iit-jam"));
  });
});

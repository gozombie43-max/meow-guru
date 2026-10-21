import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockPyqPage from "./page";
import { requestResponse } from "@/shared/api/request";
import { invalidateMockCatalog } from "@/lib/mock-catalog-revision";

const state = vi.hoisted(() => ({ mode: "ssc" }));
vi.mock("@/context/ExamModeContext", () => ({ useExamMode: () => ({ mode: state.mode }) }));
vi.mock("@/shared/api/request", () => ({ requestResponse: vi.fn() }));
vi.mock("@/lib/mock-catalog-revision", () => ({ invalidateMockCatalog: vi.fn() }));
const papers = [
  { id: "mock-1", examSlug: "ssc-cgl", title: "CGL Mock One", type: "mock", isFree: true, order: 1, hasZipImages: true },
  { id: "pyq-1", examSlug: "ssc-chsl", title: "CHSL Official Paper", type: "pyq", year: 2024, shift: "Morning", isFree: false, hasZipImages: false },
  { id: "jam-1", examSlug: "iit-jam-physics", title: "JAM Paper", type: "pyq", year: 2025 },
];
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

beforeEach(() => { state.mode = "ssc"; vi.mocked(invalidateMockCatalog).mockClear(); vi.mocked(requestResponse).mockReset().mockImplementation(async () => response({ slots: papers })); });
afterEach(cleanup);

describe("Mock & Pyq management", () => {
  it("sorts by date before pagination and shows dates in the table", async () => {
    const slots = Array.from({ length: 30 }, (_, index) => ({
      id: `paper-${30 - index}`, examSlug: 'ssc-chsl', title: `Paper ${30 - index}`, type: 'pyq', year: 2025,
      examDate: `2025-11-${String(30 - index).padStart(2, '0')}`, shift: 1,
    }));
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ slots }));
    render(<MockPyqPage />);
    await screen.findByRole('button', { name: 'Edit Paper 1' });
    const titles = () => screen.getAllByRole('row').slice(1).map(row => row.querySelector('strong')?.textContent);
    expect(titles()).toEqual(Array.from({ length: 25 }, (_, index) => `Paper ${index + 1}`));
    expect(screen.getByText('1 Nov 2025')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(titles()).toEqual(['Paper 26', 'Paper 27', 'Paper 28', 'Paper 29', 'Paper 30']);
  });

  it("combines filters and clears them without exposing the other exam mode", async () => {
    render(<MockPyqPage />);
    await screen.findByText("CGL Mock One");
    expect(screen.getByRole('columnheader', { name: 'ZIP images' })).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /CGL Mock One/ })).getByText('Added')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /CHSL Official Paper/ })).getByText('Not added')).toBeInTheDocument();
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
    expect(invalidateMockCatalog).toHaveBeenCalledWith("ssc-cgl");
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
    expect(invalidateMockCatalog).not.toHaveBeenCalled();
  });

  it.each([
    { shift: 1, expected: 1 },
    { shift: 3, expected: 3 },
    { shift: " Shift 2 ", expected: "Shift 2" },
    { shift: null, expected: null },
    { shift: undefined, expected: null },
    { shift: "  ", expected: null },
  ])("saves title changes when the stored shift is $shift", async ({ shift, expected }) => {
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ slots: [{ ...papers[1], shift }] }));
    render(<MockPyqPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit CHSL Official Paper" }));
    expect(screen.getByLabelText("Shift")).toHaveValue(shift == null ? "" : String(shift));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated CHSL title" } });
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ success: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Paper details saved.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Updated CHSL title")).toBeInTheDocument();
    const [url, options] = vi.mocked(requestResponse).mock.calls[1];
    expect(url).toContain("/admin/slots/pyq-1?examMode=ssc");
    expect(options?.method).toBe("PATCH");
    expect(JSON.parse(String(options?.body))).toMatchObject({ title: "Updated CHSL title", shift: expected });
    expect(screen.queryByRole("form", { name: "Edit paper" })).not.toBeInTheDocument();
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

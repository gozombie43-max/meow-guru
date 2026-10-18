import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaperQuestionsEditor from "./PaperQuestionsEditor";
import { requestResponse } from "@/shared/api/request";

vi.mock("@/shared/api/request", () => ({ requestResponse: vi.fn() }));
vi.mock("@/components/QuestionImage", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} /> }));
const paper = { id: "paper100", examSlug: "ssc-cgl", title: "Full Mock Test" };
const questions = Array.from({ length: 100 }, (_, index) => ({ id: `q${index + 1}`, sectionKey: index < 50 ? "math" : "english", questionType: "MCQ",
  question: `Question text ${index + 1}`, options: ["One", "Two", "Three", "Four"], correctAnswer: 0, solution: "Explanation", questionImage: null }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const props = () => ({ paper, mode: "ssc" as const, onClose: vi.fn() });
beforeEach(() => { vi.mocked(requestResponse).mockReset().mockResolvedValue(response({ updatedAt: "original-version", questions })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Paper question editor", () => {
  it("edits question 100 and preserves drafts when moving between questions", async () => {
    render(<PaperQuestionsEditor {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Question 100" }));
    expect(screen.getByLabelText("Question text")).toHaveValue("Question text 100");
    fireEvent.change(screen.getByLabelText("Question text"), { target: { value: "Edited last question" } });
    fireEvent.change(screen.getByLabelText("Option B"), { target: { value: "Updated option" } });
    fireEvent.change(screen.getByLabelText("Correct answer"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByLabelText("Question text")).toHaveValue("Edited last question");
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ success: true, updatedAt: "new-version" }));
    fireEvent.click(screen.getByRole("button", { name: "Save question changes" }));
    await screen.findByText("1 question saved.");
    const [url, options] = vi.mocked(requestResponse).mock.calls[1];
    expect(url).toContain("/slots/paper100/questions?examSlug=ssc-cgl&examMode=ssc");
    expect(options?.method).toBe("PATCH");
    expect(JSON.parse(String(options?.body))).toMatchObject({ expectedUpdatedAt: "original-version", edits: [{ id: "q100", question: "Edited last question", correctAnswer: 1 }] });
    expect(screen.getByRole("button", { name: "Save question changes" })).toBeDisabled();
  });

  it("uploads, previews and saves an image on the selected question", async () => {
    render(<PaperQuestionsEditor {...props()} />);
    await screen.findByLabelText("Upload question image");
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ url: "/api/upload/image/new-image" }));
    const file = new File(["image"], "question.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload question image"), { target: { files: [file] } });
    expect(await screen.findByRole("img", { name: "Question 1 image preview" })).toHaveAttribute("data-src", "/api/upload/image/new-image");
    const [uploadUrl, uploadOptions] = vi.mocked(requestResponse).mock.calls[1];
    expect(uploadUrl).toContain("/api/upload/question-image?examMode=ssc");
    expect((uploadOptions?.body as FormData).get("image")).toBeInstanceOf(File);
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ success: true, updatedAt: "next" }));
    fireEvent.click(screen.getByRole("button", { name: "Save question changes" }));
    await screen.findByText("1 question saved.");
    expect(JSON.parse(String(vi.mocked(requestResponse).mock.calls[2][1]?.body)).edits[0].questionImage).toBe("/api/upload/image/new-image");
    fireEvent.click(screen.getByRole("button", { name: "Remove image" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save question changes" })).toBeEnabled();
  });

  it("retains edits after a conflict and guards against discarding drafts", async () => {
    const config = props(); const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PaperQuestionsEditor {...config} />);
    fireEvent.change(await screen.findByLabelText("Question text"), { target: { value: "Unsaved change" } });
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ error: "Paper changed. Reload before saving." }, 409));
    fireEvent.click(screen.getByRole("button", { name: "Save question changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Paper changed");
    expect(screen.getByLabelText("Question text")).toHaveValue("Unsaved change");
    fireEvent.click(screen.getByRole("button", { name: "Back to papers" }));
    expect(confirm).toHaveBeenCalled(); expect(config.onClose).not.toHaveBeenCalled();
  });

  it("edits Bangla without overwriting English and filters across all questions", async () => {
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ updatedAt: null, questions: [{ ...questions[0], translations: { bn: { question: "বাংলা", options: ["১", "২", "৩", "৪"], solution: "সমাধান" } } }] }));
    render(<PaperQuestionsEditor {...props()} />);
    fireEvent.change(await screen.findByLabelText("Language"), { target: { value: "bn" } });
    fireEvent.change(screen.getByLabelText("Question text"), { target: { value: "নতুন প্রশ্ন" } });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "en" } });
    expect(screen.getByLabelText("Question text")).toHaveValue("Question text 1");
    vi.mocked(requestResponse).mockResolvedValueOnce(response({ updatedAt: "next" }));
    fireEvent.click(screen.getByRole("button", { name: "Save question changes" }));
    await screen.findByText("1 question saved.");
    expect(JSON.parse(String(vi.mocked(requestResponse).mock.calls[1][1]?.body)).edits[0].translations.bn.question).toBe("নতুন প্রশ্ন");
    fireEvent.change(screen.getByLabelText("Find question"), { target: { value: "missing" } });
    await waitFor(() => expect(screen.getByText("No questions match this search.")).toBeInTheDocument());
  });
});

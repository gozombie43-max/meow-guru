import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { requestResponse } from "@/shared/api/request";

vi.mock("@/shared/api/request", () => ({
  requestResponse: vi.fn(),
}));

vi.mock("@/context/ExamModeContext", () => ({
  useExamMode: () => ({ mode: "ssc", isJam: false, setMode: vi.fn() }),
  ExamModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

let Component: React.ComponentType<Record<string, unknown>> | null = null;

const mockResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const COMPONENT_PATH = "../QuestionBankZipUpload";

beforeEach(async () => {
  vi.mocked(requestResponse).mockReset();
  try {
    const mod = await import(/* @vite-ignore */ COMPONENT_PATH);
    Component = mod.default || mod.QuestionBankZipUpload;
  } catch {
    Component = null;
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function getComponent() {
  if (!Component) {
    throw new Error(
      "M4 implementation required: frontend/features/admin/questions/QuestionBankZipUpload.tsx is not yet implemented."
    );
  }
  return Component;
}

describe("QuestionBankZipUpload Component", () => {
  it("renders policy doc download link and manifest template button", async () => {
    const QuestionBankZipUpload = getComponent();
    render(<QuestionBankZipUpload />);

    // Policy doc link
    const policyLink = screen.getByRole("link", { name: /Download ZIP format|policy/i });
    expect(policyLink).toBeInTheDocument();
    expect(policyLink).toHaveAttribute("href", "/docs/question-bank-image-zip-policy.md");

    // Manifest template download button
    const templateBtn = screen.getByRole("button", { name: /manifest template/i });
    expect(templateBtn).toBeInTheDocument();
    expect(templateBtn).toBeEnabled();
  });

  it("upload button is disabled until validation succeeds", async () => {
    const QuestionBankZipUpload = getComponent();
    render(<QuestionBankZipUpload />);

    // Initially disabled
    const uploadBtn = screen.getByRole("button", { name: /Upload & link/i });
    expect(uploadBtn).toBeDisabled();

    // Select a valid ZIP file
    const fileInput = screen.getByLabelText(/ZIP/i);
    const testZipFile = new File(["dummy zip binary"], "questions.zip", { type: "application/zip" });
    fireEvent.change(fileInput, { target: { files: [testZipFile] } });

    // Upload button must STILL be disabled before validation
    expect(uploadBtn).toBeDisabled();

    // Validate button should now be enabled
    const validateBtn = screen.getByRole("button", { name: /Validate ZIP/i });
    expect(validateBtn).toBeEnabled();
  });

  it("validate posts the ZIP with action=validate and enables upload button", async () => {
    const QuestionBankZipUpload = getComponent();
    render(<QuestionBankZipUpload onRefresh={vi.fn()} />);

    const fileInput = screen.getByLabelText(/ZIP/i);
    const testZipFile = new File(["dummy zip binary"], "questions.zip", { type: "application/zip" });
    fireEvent.change(fileInput, { target: { files: [testZipFile] } });

    const previewData = {
      valid: true,
      summary: {
        questionCount: 2,
        fileCount: 3,
        targetCount: 3,
        targets: [
          { questionId: "q1", target: "question", file: "images/q1.png", replaces: true, status: "Already linked · will replace image" },
          { questionId: "q1", target: "option", option: "A", language: "en", file: "images/opt_a.png", replaces: false, status: "New image · ready to upload" },
          { questionId: "q2", target: "solution", file: "images/sol2.png", replaces: false, status: "New image · ready to upload" },
        ],
        expectedUpdatedAts: { q1: "2026-10-23T00:00:00.000Z", q2: "2026-10-23T00:00:00.000Z" },
      },
    };

    vi.mocked(requestResponse).mockResolvedValueOnce(mockResponse(previewData));

    const validateBtn = screen.getByRole("button", { name: /Validate ZIP/i });
    fireEvent.click(validateBtn);

    // Verify request payload
    await waitFor(() => expect(requestResponse).toHaveBeenCalledTimes(1));
    const [url, options] = vi.mocked(requestResponse).mock.calls[0];
    expect(url).toContain("/api/questions/admin/image-zip");
    expect(url).toContain("examMode=ssc");
    const formData = options?.body as FormData;
    expect(formData.get("action")).toBe("validate");
    expect(formData.get("zipFile")).toBe(testZipFile);

    // Upload button should now be enabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Upload & link/i })).toBeEnabled();
    });
  });

  it("target preview renders correctly after validation", async () => {
    const QuestionBankZipUpload = getComponent();
    render(<QuestionBankZipUpload />);

    const fileInput = screen.getByLabelText(/ZIP/i);
    const testZipFile = new File(["zip content"], "import.zip", { type: "application/zip" });
    fireEvent.change(fileInput, { target: { files: [testZipFile] } });

    const previewData = {
      valid: true,
      summary: {
        questionCount: 2,
        fileCount: 2,
        targetCount: 2,
        targets: [
          { questionId: "q101", target: "question", file: "images/diagram.png", replaces: true, status: "Already linked · will replace image" },
          { questionId: "q102", target: "solution", file: "images/solution.png", replaces: false, status: "New image · ready to upload" },
        ],
      },
    };

    vi.mocked(requestResponse).mockResolvedValueOnce(mockResponse(previewData));
    fireEvent.click(screen.getByRole("button", { name: /Validate ZIP/i }));

    // Target preview elements
    await screen.findByText(/Validated: 2 files? · 2 questions?/i);
    expect(screen.getByText("q101")).toBeInTheDocument();
    expect(screen.getByText(/images\/diagram\.png/)).toBeInTheDocument();
    expect(screen.getByText(/Already linked · will replace image/i)).toBeInTheDocument();

    expect(screen.getByText("q102")).toBeInTheDocument();
    expect(screen.getByText(/images\/solution\.png/)).toBeInTheDocument();
    expect(screen.getByText(/New image · ready to upload/i)).toBeInTheDocument();
  });

  it("server error messages appear in an alert and block upload", async () => {
    const QuestionBankZipUpload = getComponent();
    render(<QuestionBankZipUpload />);

    const fileInput = screen.getByLabelText(/ZIP/i);
    const testZipFile = new File(["corrupt zip"], "bad.zip", { type: "application/zip" });
    fireEvent.change(fileInput, { target: { files: [testZipFile] } });

    vi.mocked(requestResponse).mockResolvedValueOnce(
      mockResponse({ error: "Missing manifest.json at ZIP root. Download the format guide and add the manifest." }, 422)
    );

    fireEvent.click(screen.getByRole("button", { name: /Validate ZIP/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Missing manifest\.json at ZIP root/i);
    expect(screen.getByRole("button", { name: /Upload & link/i })).toBeDisabled();
  });

  it("submitting apply sends expectedUpdatedAts and reloads on success", async () => {
    const QuestionBankZipUpload = getComponent();
    const handleSuccess = vi.fn();
    render(<QuestionBankZipUpload onSuccess={handleSuccess} onRefresh={handleSuccess} />);

    const fileInput = screen.getByLabelText(/ZIP/i);
    const testZipFile = new File(["zip content"], "import.zip", { type: "application/zip" });
    fireEvent.change(fileInput, { target: { files: [testZipFile] } });

    const previewData = {
      valid: true,
      summary: {
        questionCount: 1,
        fileCount: 1,
        targetCount: 1,
        targets: [{ questionId: "q1", target: "question", file: "images/q1.png", replaces: false }],
        expectedUpdatedAts: { q1: "2026-10-23T00:00:00.000Z" },
      },
    };

    vi.mocked(requestResponse).mockResolvedValueOnce(mockResponse(previewData));
    fireEvent.click(screen.getByRole("button", { name: /Validate ZIP/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Upload & link/i })).toBeEnabled());

    // Apply response
    vi.mocked(requestResponse).mockResolvedValueOnce(
      mockResponse({ success: true, appliedCount: 1, questionCount: 1, message: "Successfully updated 1 question with 1 image." })
    );

    fireEvent.click(screen.getByRole("button", { name: /Upload & link/i }));

    await waitFor(() => expect(requestResponse).toHaveBeenCalledTimes(2));
    const [, applyOptions] = vi.mocked(requestResponse).mock.calls[1];
    const applyFormData = applyOptions?.body as FormData;
    expect(applyFormData.get("action")).toBe("apply");
    expect(applyFormData.get("expectedUpdatedAts")).toBe(JSON.stringify({ q1: "2026-10-23T00:00:00.000Z" }));

    await screen.findByText(/Upload successful|Successfully updated/i);
  });

  it("shows a usable message when an upstream error is structured", async () => {
    const QuestionBankZipUpload = getComponent();
    render(<QuestionBankZipUpload />);

    const file = new File(["zip content"], "import.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText(/ZIP/i), { target: { files: [file] } });
    vi.mocked(requestResponse).mockResolvedValueOnce(mockResponse({
      valid: true,
      summary: {
        questionCount: 1,
        fileCount: 1,
        targetCount: 1,
        targets: [{ questionId: "q1", target: "question", file: "images/q1.png" }],
        expectedUpdatedAts: { q1: "2026-10-23T00:00:00.000Z" },
      },
    }));
    fireEvent.click(screen.getByRole("button", { name: /Validate ZIP/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Upload & link/i })).toBeEnabled());

    vi.mocked(requestResponse).mockResolvedValueOnce(mockResponse({
      error: { code: "GatewayTimeout", message: "The import request timed out upstream." },
    }, 504));
    fireEvent.click(screen.getByRole("button", { name: /Upload & link/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The import request timed out upstream.");
    expect(alert).not.toHaveTextContent("[object Object]");
  });
});

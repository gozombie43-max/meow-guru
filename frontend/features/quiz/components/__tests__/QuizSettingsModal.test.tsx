import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { QuizSettingsModal, SettingIcon, OptionTickIcon } from "@/features/quiz/components/ui/QuizSettingsModal";

describe("QuizSettingsModal", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    theme: "dark" as const,
    onToggleTheme: vi.fn(),
    hideQuestionNumbers: false,
    onToggleHideQuestionNumbers: vi.fn(),
    hideViewSolution: false,
    onToggleHideViewSolution: vi.fn(),
    hideAiTutor: false,
    onToggleHideAiTutor: vi.fn(),
    onToggleHideBoth: vi.fn(),
    textSize: "md" as const,
    onTextSizeChange: vi.fn(),
    spacing: "comfortable" as const,
    onSpacingChange: vi.fn(),
  };

  it("changes text boldness", () => {
    const onTextWeightChange = vi.fn();
    render(<QuizSettingsModal {...defaultProps} textWeight="medium" onTextWeightChange={onTextWeightChange} />);
    const select = screen.getByRole("combobox", { name: "Text boldness" });
    expect(select).toHaveValue("medium");
    fireEvent.change(select, { target: { value: "high" } });
    expect(onTextWeightChange).toHaveBeenCalledWith("high");
  });

  it("renders when isOpen is true", () => {
    render(<QuizSettingsModal {...defaultProps} />);
    expect(screen.getByText("Quiz Settings")).toBeInTheDocument();
    expect(screen.getByText("Text size")).toBeInTheDocument();
    expect(screen.getByText("Custom size")).toBeInTheDocument();
    expect(screen.getByText("Boldness")).toBeInTheDocument();
    expect(screen.getByText("Spacing")).toBeInTheDocument();
    expect(screen.getByText("Dark theme")).toBeInTheDocument();
    expect(screen.getByText("Hide question strip")).toBeInTheDocument();
    expect(screen.getByText("Hide Tools")).toBeInTheDocument();
    expect(screen.getByText("Solution")).toBeInTheDocument();
    expect(screen.getByText("AI tutor")).toBeInTheDocument();
    expect(screen.getByText("Both")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<QuizSettingsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Quiz Settings")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<QuizSettingsModal {...defaultProps} onClose={onClose} />);
    const closeBtn = screen.getByLabelText("Close settings");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<QuizSettingsModal {...defaultProps} onClose={onClose} />);
    const backdrop = screen.getByTestId("settings-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onTextSizeChange when text size dropdown changes", () => {
    const onTextSizeChange = vi.fn();
    render(<QuizSettingsModal {...defaultProps} onTextSizeChange={onTextSizeChange} />);
    const select = screen.getByRole("combobox", { name: "Text size" });
    fireEvent.change(select, { target: { value: "sm" } });
    expect(onTextSizeChange).toHaveBeenCalledWith("sm");

    fireEvent.change(select, { target: { value: "lg" } });
    expect(onTextSizeChange).toHaveBeenCalledWith("lg");
  });

  it("calls onSpacingChange when spacing dropdown changes", () => {
    const onSpacingChange = vi.fn();
    render(<QuizSettingsModal {...defaultProps} onSpacingChange={onSpacingChange} />);
    const select = screen.getByRole("combobox", { name: "Spacing" });
    fireEvent.change(select, { target: { value: "compact" } });
    expect(onSpacingChange).toHaveBeenCalledWith("compact");

    fireEvent.change(select, { target: { value: "comfortable" } });
    expect(onSpacingChange).toHaveBeenCalledWith("comfortable");
  });

  it("changes custom size via dropdown and updates preset selection", () => {
    const onTextSizeChange = vi.fn();
    const { rerender } = render(<QuizSettingsModal {...defaultProps} onTextSizeChange={onTextSizeChange} />);
    const customSelect = screen.getByRole("combobox", { name: "Custom text size" });
    expect(customSelect).toHaveValue("20");
    fireEvent.change(customSelect, { target: { value: "21" } });
    expect(onTextSizeChange).toHaveBeenLastCalledWith(21);

    rerender(<QuizSettingsModal {...defaultProps} textSize={21} onTextSizeChange={onTextSizeChange} />);
    expect(customSelect).toHaveValue("21");
    const presetSelect = screen.getByRole("combobox", { name: "Text size" });
    expect(presetSelect).toHaveValue("custom");

    fireEvent.change(presetSelect, { target: { value: "md" } });
    expect(onTextSizeChange).toHaveBeenLastCalledWith("md");
  });

  it("supports custom size limits in dropdown options", () => {
    render(<QuizSettingsModal {...defaultProps} textSize={16} />);
    const customSelect = screen.getByRole("combobox", { name: "Custom text size" }) as HTMLSelectElement;
    const optionValues = Array.from(customSelect.options).map((opt) => opt.value);
    expect(optionValues[0]).toBe("16");
    expect(optionValues[optionValues.length - 1]).toBe("24");
  });

  it("calls onToggleTheme when theme switch is clicked", () => {
    const onToggleTheme = vi.fn();
    render(<QuizSettingsModal {...defaultProps} onToggleTheme={onToggleTheme} />);
    const themeSwitch = screen.getByRole("switch", { name: /toggle dark\/light theme/i });
    fireEvent.click(themeSwitch);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleHideQuestionNumbers when question numbers switch is clicked", () => {
    const onToggleHideQuestionNumbers = vi.fn();
    render(
      <QuizSettingsModal
        {...defaultProps}
        hideQuestionNumbers={false}
        onToggleHideQuestionNumbers={onToggleHideQuestionNumbers}
      />
    );
    const qSwitch = screen.getByRole("switch", { name: /toggle hide question numbers row/i });
    expect(qSwitch).toHaveAttribute("aria-checked", "false");
    fireEvent.click(qSwitch);
    expect(onToggleHideQuestionNumbers).toHaveBeenCalledWith(true);
  });

  it("calls onToggleHideViewSolution when hide solution switch is clicked", () => {
    const onToggleHideViewSolution = vi.fn();
    render(
      <QuizSettingsModal
        {...defaultProps}
        hideViewSolution={false}
        onToggleHideViewSolution={onToggleHideViewSolution}
      />
    );
    const solSwitch = screen.getByRole("button", { name: /toggle hide view solution/i });
    expect(solSwitch).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(solSwitch);
    expect(onToggleHideViewSolution).toHaveBeenCalledWith(true);
  });

  it("calls onToggleHideAiTutor when hide AI tutor switch is clicked", () => {
    const onToggleHideAiTutor = vi.fn();
    render(
      <QuizSettingsModal
        {...defaultProps}
        hideAiTutor={false}
        onToggleHideAiTutor={onToggleHideAiTutor}
      />
    );
    const tutorSwitch = screen.getByRole("button", { name: /toggle hide ai tutor/i });
    expect(tutorSwitch).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(tutorSwitch);
    expect(onToggleHideAiTutor).toHaveBeenCalledWith(true);
  });

  it("handles hide both switch correctly", () => {
    const onToggleHideBoth = vi.fn();
    const { rerender } = render(
      <QuizSettingsModal
        {...defaultProps}
        hideViewSolution={false}
        hideAiTutor={false}
        onToggleHideBoth={onToggleHideBoth}
      />
    );
    const bothSwitch = screen.getByRole("button", { name: /toggle hide both solution and ai tutor/i });
    expect(bothSwitch).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(bothSwitch);
    expect(onToggleHideBoth).toHaveBeenCalledWith(true);

    rerender(
      <QuizSettingsModal
        {...defaultProps}
        hideViewSolution={true}
        hideAiTutor={true}
        onToggleHideBoth={onToggleHideBoth}
      />
    );
    expect(bothSwitch).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(bothSwitch);
    expect(onToggleHideBoth).toHaveBeenCalledWith(false);
  });

  it("renders SettingIcon SVG correctly", () => {
    const { container } = render(<SettingIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders OptionTickIcon SVG correctly", () => {
    const { container } = render(<OptionTickIcon className="test-tick" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveClass("test-tick");
  });
});

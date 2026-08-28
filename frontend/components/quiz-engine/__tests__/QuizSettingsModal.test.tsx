import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { QuizSettingsModal, SettingIcon, OptionTickIcon } from "../ui/QuizSettingsModal";

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
  };

  it("renders when isOpen is true", () => {
    render(<QuizSettingsModal {...defaultProps} />);
    expect(screen.getByText("Quiz Settings")).toBeInTheDocument();
    expect(screen.getByText("Dark Theme")).toBeInTheDocument();
    expect(screen.getByText("Hide Question Strip")).toBeInTheDocument();
    expect(screen.getByText("Hide View Solution")).toBeInTheDocument();
    expect(screen.getByText("Hide AI Tutor")).toBeInTheDocument();
    expect(screen.getByText("Hide Both")).toBeInTheDocument();
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
    const solSwitch = screen.getByRole("switch", { name: /toggle hide view solution/i });
    expect(solSwitch).toHaveAttribute("aria-checked", "false");
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
    const tutorSwitch = screen.getByRole("switch", { name: /toggle hide ai tutor/i });
    expect(tutorSwitch).toHaveAttribute("aria-checked", "false");
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
    const bothSwitch = screen.getByRole("switch", { name: /toggle hide both solution and ai tutor/i });
    expect(bothSwitch).toHaveAttribute("aria-checked", "false");
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
    expect(bothSwitch).toHaveAttribute("aria-checked", "true");
    fireEvent.click(bothSwitch);
    expect(onToggleHideBoth).toHaveBeenCalledWith(false);
  });

  it("renders SettingIcon SVG correctly", () => {
    const { container } = render(<SettingIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 30 30");
  });

  it("renders OptionTickIcon SVG correctly", () => {
    const { container } = render(<OptionTickIcon className="test-tick" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveClass("test-tick");
  });
});

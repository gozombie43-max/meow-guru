"use client";

import { Dialog } from "@/components/ui/Dialog";
import {
  AlignJustify,
  Bot,
  FileText,
  Layers,
  ListOrdered,
  LogOut,
  Moon,
  Minus,
  Plus,
  Settings,
  Sun,
  Type,
  X,
} from "lucide-react";
import type { QuizTheme } from "@/features/quiz/model/types";
import type { QuizSpacing,QuizTextSize,QuizTextWeight } from "@/features/quiz/components/useQuizPreferences";
import { getQuizTextSizePixels, MIN_QUIZ_TEXT_SIZE, MAX_QUIZ_TEXT_SIZE } from "@/features/quiz/components/useQuizPreferences";

export function SettingIcon({ className = "w-4.5 h-4.5" }: { className?: string }) {
  return <Settings className={className} aria-hidden="true" />;
}

export function OptionTickIcon({
  className = "w-5 h-5",
  "aria-label": ariaLabel = "Correct option",
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      <path d="M 12 2 C 6.5 2 2 6.5 2 12 C 2 17.5 6.5 22 12 22 C 17.5 22 22 17.5 22 12 C 22 10.9 21.8 9.8007812 21.5 8.8007812 L 19.800781 10.400391 C 19.900781 10.900391 20 11.4 20 12 C 20 16.4 16.4 20 12 20 C 7.6 20 4 16.4 4 12 C 4 7.6 7.6 4 12 4 C 13.6 4 15.100391 4.5007812 16.400391 5.3007812 L 17.800781 3.9003906 C 16.200781 2.7003906 14.2 2 12 2 z M 21.300781 3.3007812 L 11 13.599609 L 7.6992188 10.300781 L 6.3007812 11.699219 L 11 16.400391 L 22.699219 4.6992188 L 21.300781 3.3007812 z" />
    </svg>
  );
}

interface SwitchToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  ariaLabel: string;
}

function SwitchToggle({ checked, onChange, ariaLabel }: SwitchToggleProps) {
  return (
    <button data-ui-button="state"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`ios-settings-switch ${checked ? "is-active" : ""}`}
    >
      <span className="ios-settings-switch-thumb" />
    </button>
  );
}

export interface QuizSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeaveQuiz?: () => void;
  theme: QuizTheme;
  onToggleTheme: () => void;
  hideQuestionNumbers: boolean;
  onToggleHideQuestionNumbers: (val: boolean) => void;
  hideViewSolution: boolean;
  onToggleHideViewSolution: (val: boolean) => void;
  hideAiTutor: boolean;
  onToggleHideAiTutor: (val: boolean) => void;
  onToggleHideBoth: (val: boolean) => void;
  textWeight?: QuizTextWeight;
  onTextWeightChange?: (weight: QuizTextWeight) => void;
  textSize?: QuizTextSize;
  onTextSizeChange?: (val: QuizTextSize) => void;
  spacing?: QuizSpacing;
  onSpacingChange?: (val: QuizSpacing) => void;
}

export function QuizSettingsModal({
  isOpen,
  onClose,
  onLeaveQuiz,
  theme,
  onToggleTheme,
  hideQuestionNumbers,
  onToggleHideQuestionNumbers,
  hideViewSolution,
  onToggleHideViewSolution,
  hideAiTutor,
  onToggleHideAiTutor,
  onToggleHideBoth,
  textWeight = "medium",
  onTextWeightChange,
  textSize = "md",
  onTextSizeChange,
  spacing = "comfortable",
  onSpacingChange,
}: QuizSettingsModalProps) {
  if (!isOpen) return null;

  const isDark = theme === "dark";
  const hideBoth = hideViewSolution && hideAiTutor;
  const textSizePixels = getQuizTextSizePixels(textSize);

  return (
    <>
      <div
        className="ios-settings-backdrop"
        data-dialog-backdrop
        onClick={onClose}
        aria-hidden="true"
        data-testid="settings-backdrop"
      />
      <Dialog onClose={onClose}
        className="ios-settings-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Quiz settings"
        data-theme={theme}
      >
        <div data-ui-chrome="header" className="ios-settings-header">
          <div className="ios-settings-title-group">
            <span className="ios-settings-title">Quiz Settings</span>
          </div>
          <button data-ui-button="icon"
            type="button"
            className="ios-settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ios-settings-list">
          {/* Section: Reading Comfort */}
          <section className="ios-settings-section" aria-label="Reading comfort">
          <h3 className="ios-settings-section-title">Reading Comfort</h3>
          <div className="ios-settings-card">

          {/* Text Size Row */}
          <div className="ios-settings-item">
            <div className="ios-settings-item-left">
              <div className="ios-settings-icon-box text-size-icon">
                <Type size={15} />
              </div>
              <div className="ios-settings-label-wrap">
                <span className="ios-settings-label">Text Size</span>
                <span className="ios-settings-sublabel">Questions & answers</span>
              </div>
            </div>
            <div className="ios-settings-segmented" role="group" aria-label="Text size options">
              <button
                type="button"
                className={`ios-segment-btn ${textSize === "sm" ? "is-active" : ""}`}
                onClick={() => onTextSizeChange?.("sm")}
                aria-pressed={textSize === "sm"}
              >
                S
              </button>
              <button
                type="button"
                className={`ios-segment-btn ${textSize === "md" ? "is-active" : ""}`}
                onClick={() => onTextSizeChange?.("md")}
                aria-pressed={textSize === "md"}
              >
                M
              </button>
              <button
                type="button"
                className={`ios-segment-btn ${textSize === "lg" ? "is-active" : ""}`}
                onClick={() => onTextSizeChange?.("lg")}
                aria-pressed={textSize === "lg"}
              >
                L
              </button>
            </div>
          </div>

          <div className="ios-settings-divider" />

          <div className="ios-settings-custom-size">
            <div className="ios-settings-label-wrap"><span className="ios-settings-label">Custom text size</span><span className="ios-settings-sublabel">{MIN_QUIZ_TEXT_SIZE}–{MAX_QUIZ_TEXT_SIZE} px</span></div>
            <div className="ios-text-size-stepper" role="group" aria-label="Custom text size">
              <button type="button" data-ui-button="state" className="ios-text-size-step" aria-label="Decrease text size" disabled={!onTextSizeChange || textSizePixels <= MIN_QUIZ_TEXT_SIZE} onClick={() => onTextSizeChange?.(textSizePixels - 1)}>
                <Minus size={20} aria-hidden="true" />
              </button>
              <output className="ios-text-size-value" aria-live="polite" aria-label="Current text size">{textSizePixels}<span>px</span></output>
              <button type="button" data-ui-button="state" className="ios-text-size-step is-increase" aria-label="Increase text size" disabled={!onTextSizeChange || textSizePixels >= MAX_QUIZ_TEXT_SIZE} onClick={() => onTextSizeChange?.(textSizePixels + 1)}>
                <Plus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="ios-settings-divider" />

          <div className="ios-settings-item">
            <div className="ios-settings-item-left"><div className="ios-settings-icon-box text-size-icon"><Type size={15} /></div><span className="ios-settings-label">Text Boldness</span></div>
            <div className="ios-settings-segmented" role="group" aria-label="Text boldness">
              {(["low", "medium", "high"] as const).map((weight) => (
                <button key={weight} type="button" data-ui-button="state" className={`ios-segment-btn ${textWeight === weight ? "is-active" : ""}`} aria-label={`${weight} text boldness`} aria-pressed={textWeight === weight} onClick={() => onTextWeightChange?.(weight)}>{weight[0].toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="ios-settings-divider" />

          {/* Spacing Row */}
          <div className="ios-settings-item">
            <div className="ios-settings-item-left">
              <div className="ios-settings-icon-box spacing-icon">
                <AlignJustify size={15} />
              </div>
              <div className="ios-settings-label-wrap">
                <span className="ios-settings-label">Spacing</span>
                <span className="ios-settings-sublabel">Option cards density</span>
              </div>
            </div>
            <div className="ios-settings-segmented" role="group" aria-label="Layout spacing options">
              <button
                type="button"
                className={`ios-segment-btn ios-segment-btn-wide ${spacing === "comfortable" ? "is-active" : ""}`}
                onClick={() => onSpacingChange?.("comfortable")}
                aria-pressed={spacing === "comfortable"}
              >
                Comfort
              </button>
              <button
                type="button"
                className={`ios-segment-btn ios-segment-btn-wide ${spacing === "compact" ? "is-active" : ""}`}
                onClick={() => onSpacingChange?.("compact")}
                aria-pressed={spacing === "compact"}
              >
                Compact
              </button>
            </div>
          </div>

          <div className="ios-settings-divider" />

          </div>
          </section>
          <section className="ios-settings-section" aria-label="Display and features">
          <h3 className="ios-settings-section-title">Display & Features</h3>
          <div className="ios-settings-card">

          {/* Theme Row */}
          <div className="ios-settings-item">
            <div className="ios-settings-item-left">
              <div className="ios-settings-icon-box theme-icon">
                {isDark ? <Moon size={15} /> : <Sun size={15} />}
              </div>
              <div className="ios-settings-label-wrap">
                <span className="ios-settings-label">Dark Theme</span>
                <span className="ios-settings-sublabel">
                  {isDark ? "Soft dark active" : "Light mode active"}
                </span>
              </div>
            </div>
            <SwitchToggle
              checked={isDark}
              onChange={onToggleTheme}
              label="Theme"
              ariaLabel="Toggle dark/light theme"
            />
          </div>

          <div className="ios-settings-divider" />

          {/* Hide Question Numbers Row */}
          <div className="ios-settings-item">
            <div className="ios-settings-item-left">
              <div className="ios-settings-icon-box q-numbers-icon">
                <ListOrdered size={15} />
              </div>
              <div className="ios-settings-label-wrap">
                <span className="ios-settings-label">Hide Question Strip</span>
                <span className="ios-settings-sublabel">Hide question number row</span>
              </div>
            </div>
            <SwitchToggle
              checked={hideQuestionNumbers}
              onChange={onToggleHideQuestionNumbers}
              label="Hide Question Numbers"
              ariaLabel="Toggle hide question numbers row"
            />
          </div>

          <div className="ios-settings-divider" />

          </div>
          </section>
          <section className="ios-settings-visibility" aria-label="Tool visibility">
            <div className="ios-settings-tools-heading"><h3 className="ios-settings-section-title">Hide tools</h3><span className="ios-settings-sublabel">Select tools to hide</span></div>
            <div className="ios-settings-tool-options" role="group" aria-label="Hide quiz tools">
              <button type="button" data-ui-button="state" className="ios-settings-tool-btn" aria-label="Toggle hide view solution" aria-pressed={hideViewSolution} onClick={() => onToggleHideViewSolution(!hideViewSolution)}>
                <FileText size={17} aria-hidden="true" /><span>Solution</span>
              </button>
              <button type="button" data-ui-button="state" className="ios-settings-tool-btn" aria-label="Toggle hide AI tutor" aria-pressed={hideAiTutor} onClick={() => onToggleHideAiTutor(!hideAiTutor)}>
                <Bot size={17} aria-hidden="true" /><span>AI tutor</span>
              </button>
              <button type="button" data-ui-button="state" className="ios-settings-tool-btn" aria-label="Toggle hide both Solution and AI Tutor" aria-pressed={hideBoth} onClick={() => onToggleHideBoth(!hideBoth)}>
                <Layers size={17} aria-hidden="true" /><span>Both</span>
              </button>
            </div>
          </section>
        </div>
        {onLeaveQuiz && (
          <button
            data-ui-button="secondary"
            type="button"
            className="ios-settings-leave-btn"
            onClick={onLeaveQuiz}
          >
            <LogOut size={18} aria-hidden="true" />
            Leave quiz
          </button>
        )}
      </Dialog>

      <style>{`
        .ios-settings-backdrop {
          position: fixed;
          inset: 0;
          z-index: 998;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          animation: iosSettingsFade 0.15s ease-out;
        }

        .ios-settings-popover {
          position: absolute;
          top: calc(env(safe-area-inset-top) + 56px);
          left: 12px;
          width: calc(100% - 24px);
          max-width: 360px;
          max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 68px);
          overflow-y: auto;
          z-index: 999;
          border-radius: 18px;
          padding: 14px 16px 16px;
          animation: iosSettingsPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: top left;
        }

        @keyframes iosSettingsFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes iosSettingsPop {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Dark Theme Popover */
        .ios-series-quiz[data-theme="dark"] .ios-settings-popover,
        .mac-series-quiz[data-theme="dark"] .ios-settings-popover,
        .ios-settings-popover[data-theme="dark"] {
          --ui-header-surface: var(--oled-surface, #1c1c1e);
          background: var(--oled-surface, #1c1c1e);
          border: 0;
          color: var(--oled-text, #e5eaf0);
          box-shadow: none;
        }

        /* Light Theme Popover */
        .ios-series-quiz[data-theme="light"] .ios-settings-popover,
        .mac-series-quiz[data-theme="light"] .ios-settings-popover,
        .ios-settings-popover[data-theme="light"] {
          --ui-header-surface: var(--light-surface, #ffffff);
          background: var(--light-surface, #ffffff);
          border: 1px solid var(--light-border);
          color: var(--light-text);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04);
        }

        .ios-settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 6px;
        }

        .ios-settings-popover[data-theme="light"] .ios-settings-header {
          border-bottom-color: var(--light-border);
        }

        .ios-settings-title {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.2px;
        }

        .ios-settings-section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #747B85;
          margin-top: 8px;
          margin-bottom: 4px;
        }

        .ios-settings-popover[data-theme="light"] .ios-settings-section-title {
          color: #6e7781;
        }

        .ios-settings-close-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: none;
          background: rgba(255, 255, 255, 0.08);
          color: inherit;
          cursor: pointer;
          transition: background 0.15s;
        }

        .ios-settings-popover[data-theme="light"] .ios-settings-close-btn {
          background: var(--light-canvas);
          color: var(--light-text-secondary);
        }

        .ios-settings-list {
          display: flex;
          flex-direction: column;
        }

        .ios-settings-visibility { padding: 12px 0 4px; }
        .ios-settings-tool-options {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          margin-top: 8px;
          padding: 5px;
          border: 1px solid var(--ui-border);
          border-radius: 16px;
          background: var(--ui-muted-surface);
        }
        .ios-settings-tool-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-width: 0;
          padding: 8px 4px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--ui-secondary);
          font-size: 12px;
          cursor: pointer;
          transition: background 150ms, color 150ms;
        }
        .ios-settings-tool-btn[aria-pressed="true"] {
          background: var(--ios-system-blue);
          color: #fff;
        }
        .ios-settings-tool-btn:hover { border-color: var(--ios-system-blue); }
        .ios-settings-popover .ios-settings-segmented {
          padding: 4px;
          gap: 3px;
          border-radius: 14px;
          background: var(--ui-muted-surface);
        }
        .ios-settings-popover .ios-segment-btn {
          --ui-control-radius: 10px;
          border-radius: 10px;
          transition: background 150ms, color 150ms;
        }
        .ios-settings-custom-size {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 0;
        }
        .ios-text-size-stepper {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px;
          border-radius: 999px;
          background: var(--dark-surface-muted, #161e2b);
          border: 1px solid var(--dark-border, #303b4c);
        }
        .ios-settings-popover .ios-text-size-step {
          --ui-control-radius: 50%;
          display: grid;
          place-items: center;
          width: 44px;
          min-width: 44px;
          height: 44px;
          padding: 0;
          border: 1px solid rgb(255 255 255 / 10%);
          border-radius: 50%;
          color: inherit;
          background: var(--dark-surface-raised, #293548);
          transition: opacity 0.15s, transform 0.15s;
        }
        .ios-settings-popover .ios-text-size-step.is-increase {
          background: var(--ios-system-blue, #0a84ff);
          color: #fff;
        }
        .ios-text-size-step:enabled:hover { opacity: 0.85; }
        .ios-text-size-step:enabled:active { transform: scale(0.94); }
        .ios-text-size-step:focus-visible { outline: 2px solid var(--ios-system-blue, #0a84ff); outline-offset: 3px; }
        .ios-text-size-step:disabled { opacity: 0.35; cursor: not-allowed; }
        .ios-text-size-value {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 3px;
          min-width: 58px;
          padding: 8px 6px;
          border-radius: 14px;
          background: rgb(255 255 255 / 4%);
          font-size: 20px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .ios-text-size-value span { font-size: 11px; font-weight: 400; opacity: 0.65; }
        .ios-settings-popover[data-theme="light"] .ios-text-size-stepper { background: var(--light-surface-muted); border-color: var(--light-border); }
        .ios-settings-popover[data-theme="light"] .ios-text-size-step:not(.is-increase),
        .ios-settings-popover[data-theme="light"] .ios-text-size-value { background: var(--light-canvas); color: var(--light-text); }

        .ios-settings-leave-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 44px;
          margin-top: 12px;
        }

        .ios-settings-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          gap: 12px;
        }

        .ios-settings-item-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .ios-settings-icon-box {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ios-settings-icon-box.text-size-icon {
          background: rgba(114, 150, 196, 0.18);
          color: #7296C4;
        }
        .ios-settings-icon-box.spacing-icon {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
        }
        .ios-settings-icon-box.theme-icon {
          background: rgba(255, 214, 10, 0.15);
          color: #ffd60a;
        }
        .ios-settings-icon-box.q-numbers-icon {
          background: rgba(10, 132, 255, 0.15);
          color: #0a84ff;
        }
        .ios-settings-icon-box.solution-icon {
          background: rgba(48, 209, 88, 0.15);
          color: #30d158;
        }
        .ios-settings-icon-box.tutor-icon {
          background: rgba(191, 90, 242, 0.15);
          color: #bf5af2;
        }
        .ios-settings-icon-box.both-icon {
          background: rgba(255, 159, 10, 0.15);
          color: #ff9f0a;
        }

        .ios-settings-label-wrap {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .ios-settings-label {
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ios-settings-sublabel {
          font-size: 11px;
          line-height: 1.25;
          opacity: 0.65;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ios-settings-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.06);
          margin: 1px 0;
        }

        .ios-settings-popover[data-theme="light"] .ios-settings-divider {
          background: #F0F2F5;
        }

        /* iOS Segmented Controls */
        .ios-settings-segmented {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          padding: 2px;
          border-radius: 9px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        .ios-settings-popover[data-theme="light"] .ios-settings-segmented {
          background: #EEF2F6;
          border-color: #E2E8F0;
        }

        .ios-segment-btn {
          border: none;
          background: transparent;
          color: #989EA7;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 9px;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.15s ease;
          line-height: 1.2;
        }

        .ios-segment-btn-wide {
          padding: 4px 8px;
          font-size: 11.5px;
        }

        .ios-settings-popover[data-theme="light"] .ios-segment-btn {
          color: #64748B;
        }

        .ios-segment-btn.is-active {
          background: #5F8FC8;
          border: 1px solid #5F8FC8;
          color: #ffffff;
          box-shadow: 0 1px 4px rgba(95, 143, 200, 0.35);
        }

        .ios-settings-popover[data-theme="light"] .ios-segment-btn.is-active {
          background: #0071E3;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 113, 227, 0.25);
        }

        /* iOS Switch */
        .ios-settings-switch {
          position: relative;
          width: 42px;
          height: 24px;
          border-radius: 12px;
          border: none;
          padding: 2px;
          background: #222d3d;
          cursor: pointer;
          transition: background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
        }

        .ios-settings-popover[data-theme="light"] .ios-settings-switch {
          background: #e3e3e8;
        }

        .ios-settings-switch.is-active {
          background: #30d158;
        }

        .ios-settings-switch-thumb {
          display: block;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          transform: translateX(0);
        }

        .ios-settings-switch.is-active .ios-settings-switch-thumb {
          transform: translateX(18px);
        }
        .ios-settings-popover[data-theme="dark"] .ios-settings-header { border: 0; }
        .ios-settings-popover[data-theme="dark"] .ios-settings-divider { background: transparent; }
        .ios-settings-popover[data-theme="dark"] :is(.ios-settings-close-btn, .ios-settings-segmented, .ios-settings-switch) {
          background: var(--oled-inset, #29292c); border: 0; box-shadow: none;
        }
        /* Shared selection surfaces; switches retain their native pill shape. */
        .ios-settings-popover .ios-settings-segmented {
          background: transparent; border: 0; padding: 0; gap: 4px; border-radius: 0;
        }
        .ios-settings-popover .ios-segment-btn {
          min-width: 44px; min-height: 44px; border-radius: 999px !important;
          background: var(--oled-inset, #29292c); border: 0; box-shadow: none;
        }
        .ios-settings-popover[data-theme="light"] .ios-segment-btn { background: var(--light-surface-muted, #edf1f6); }
        .ios-settings-popover[data-theme="light"] .ios-segment-btn.is-active { background: var(--light-accent, #0071e3); color: white; }
        .ios-settings-popover[data-theme="dark"] .ios-settings-segmented { background: transparent; }
        .ios-settings-popover[data-theme="dark"] {
          --ui-surface: var(--oled-surface, #1c1c1e);
          --ui-border: transparent;
          --ui-text: var(--oled-text, #e5eaf0);
        }
        .ios-settings-popover[data-theme="dark"] .ios-settings-header { border-bottom: 0 !important; }
        .ios-settings-popover[data-theme="dark"] :is(.ios-segment-btn.is-active, .ios-settings-switch.is-active) {
          background: var(--oled-selected, #216bc1); color: #edf4fc; border: 0; box-shadow: none;
        }
        /* Group reading controls and separate secondary display preferences. */
        .ios-settings-popover .ios-settings-header { padding: 0 0 10px; margin: 0; }
        .ios-settings-popover .ios-settings-title { font-size: 18px; letter-spacing: -0.4px; }
        .ios-settings-popover .ios-settings-list { gap: 16px; }
        .ios-settings-popover .ios-settings-section-title {
          margin: 0 0 8px; font-size: 10px; line-height: 1.4;
          letter-spacing: 0.09em; font-weight: 600; color: var(--ui-secondary);
        }
        .ios-settings-card {
          padding: 2px 10px; border-radius: 16px;
          background: rgb(128 128 128 / 7%);
          border: 1px solid rgb(128 128 128 / 12%);
        }
        .ios-settings-popover .ios-settings-card .ios-settings-item { padding: 9px 0; gap: 8px; }
        .ios-settings-popover .ios-settings-label { font-size: 12px; font-weight: 600; line-height: 1.4; }
        .ios-settings-popover .ios-settings-sublabel {
          font-size: 10px; line-height: 1.5; white-space: normal;
          overflow: visible; text-overflow: clip; color: var(--ui-secondary);
        }
        .ios-settings-popover .ios-settings-item-left { gap: 8px; }
        .ios-settings-popover .ios-settings-icon-box { width: 24px; height: 28px; background: transparent; color: var(--ui-secondary); }
        .ios-settings-popover .ios-settings-card .ios-settings-divider { background: rgb(128 128 128 / 12%); margin: 0; }
        .ios-settings-card > .ios-settings-divider:last-child { display: none; }
        .ios-settings-popover .ios-settings-custom-size { padding: 9px 0; gap: 8px; flex-wrap: nowrap; }
        .ios-settings-popover .ios-text-size-stepper { padding: 3px; gap: 2px; border: 0; background: var(--ui-muted-surface); }
        .ios-settings-popover .ios-text-size-value { min-width: 0; flex: 1; padding: 6px 0; font-size: 18px; background: transparent; }
        .ios-settings-popover .ios-settings-card .ios-settings-segmented {
          padding: 3px; gap: 2px; border-radius: 999px; background: var(--ui-muted-surface);
        }
        .ios-settings-popover .ios-settings-card :is(.ios-settings-segmented, .ios-text-size-stepper) {
          box-sizing: border-box;
          width: 148px;
          height: 50px;
          flex: 0 0 148px;
          border-radius: 999px;
        }
        .ios-settings-popover .ios-settings-card .ios-segment-btn {
          --ui-control-radius: 999px;
          flex: 1; min-width: 0; height: 44px; padding: 6px 3px; background: transparent; font-size: 11px;
        }
        .ios-settings-popover .ios-settings-card .ios-segment-btn.is-active {
          background: var(--ios-system-blue); color: white;
        }
        .ios-settings-popover .ios-settings-visibility { padding: 0; }
        .ios-settings-tools-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .ios-settings-popover .ios-settings-tool-options { margin: 0; border-radius: 999px; }
        .ios-settings-popover .ios-settings-tool-btn { --ui-control-radius: 999px; border-radius: 999px; }
        .ios-settings-popover .ios-settings-leave-btn { margin-top: 14px; color: var(--ui-secondary); }
        .ios-settings-popover[data-theme="light"] {
          --ui-surface: var(--light-surface, #fff);
          --ui-border: var(--light-border, #e2e8f0);
          --ui-text: var(--light-text, #172033);
        }
        .ios-settings-popover[data-theme="light"] .ios-text-size-stepper .ios-text-size-step:not(.is-increase) {
          background: var(--light-surface, #fff); color: var(--light-text, #172033);
        }
        @media (max-width: 360px) {
          .ios-settings-popover { padding-inline: 12px; }
          .ios-settings-popover .ios-settings-custom-size { padding-left: 0; }
        }
      `}</style>
    </>
  );
}

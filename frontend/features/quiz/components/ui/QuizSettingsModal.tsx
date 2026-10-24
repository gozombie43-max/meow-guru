"use client";

import { useModalSurface } from "@/components/ui/Dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import {
  ALargeSmall,
  Bold,
  Bot,
  ChevronDown,
  FileText,
  Layers,
  List,
  ListOrdered,
  LogOut,
  Moon,
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
    <button
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

interface SettingsSelectProps {
  ariaLabel: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}

/** Native select styled as the pill dropdown used across the quiz chrome. */
function SettingsSelect({ ariaLabel, value, disabled, onChange, children }: SettingsSelectProps) {
  return (
    <span className="ios-settings-select">
      <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <ChevronDown size={14} className="ios-settings-select-chevron" aria-hidden="true" />
    </span>
  );
}

function SettingsRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="ios-settings-item">
      <div className="ios-settings-item-left">
        <span className="ios-settings-icon-box" aria-hidden="true">{icon}</span>
        <span className="ios-settings-label">{label}</span>
      </div>
      {children}
    </div>
  );
}

const TEXT_SIZE_LABELS = { sm: "S", md: "M", lg: "L" } as const;
const TEXT_WEIGHT_LABELS = { low: "L", medium: "M", high: "H" } as const;
const CUSTOM_SIZES = Array.from({ length: MAX_QUIZ_TEXT_SIZE - MIN_QUIZ_TEXT_SIZE + 1 }, (_, index) => MIN_QUIZ_TEXT_SIZE + index);

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
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalSurface(dialogRef, isOpen, onClose);

  const isDark = theme === "dark";
  const hideBoth = hideViewSolution && hideAiTutor;
  const textSizePixels = getQuizTextSizePixels(textSize);
  const textSizePreset = typeof textSize === "string" ? textSize : "custom";

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="settings-backdrop"
              className="ios-settings-backdrop"
              data-dialog-backdrop
              onClick={onClose}
              aria-hidden="true"
              data-testid="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
            />
            <motion.div
              key="settings-popover"
              ref={dialogRef}
              className="ios-settings-popover"
              role="dialog"
              aria-modal="true"
              aria-label="Quiz settings"
              tabIndex={-1}
              data-ui-dialog
              data-theme={theme}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="ios-settings-header">
                <span className="ios-settings-title">Quiz Settings</span>
                <button
                  type="button"
                  className="ios-settings-close-btn"
                  onClick={onClose}
                  aria-label="Close settings"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="ios-settings-list">
                <section className="ios-settings-group" aria-label="Reading comfort">
                  <SettingsRow icon={<Type size={17} />} label="Text size">
                    <SettingsSelect
                      ariaLabel="Text size"
                      value={textSizePreset}
                      disabled={!onTextSizeChange}
                      onChange={(value) => onTextSizeChange?.(value as "sm" | "md" | "lg")}
                    >
                      {textSizePreset === "custom" && <option value="custom" disabled>Custom</option>}
                      {(Object.keys(TEXT_SIZE_LABELS) as Array<keyof typeof TEXT_SIZE_LABELS>).map((size) => (
                        <option key={size} value={size}>{TEXT_SIZE_LABELS[size]}</option>
                      ))}
                    </SettingsSelect>
                  </SettingsRow>

                  <SettingsRow icon={<ALargeSmall size={17} />} label="Custom size">
                    <SettingsSelect
                      ariaLabel="Custom text size"
                      value={String(textSizePixels)}
                      disabled={!onTextSizeChange}
                      onChange={(value) => onTextSizeChange?.(Number(value))}
                    >
                      {CUSTOM_SIZES.map((size) => (
                        <option key={size} value={size}>{size} px</option>
                      ))}
                    </SettingsSelect>
                  </SettingsRow>

                  <SettingsRow icon={<Bold size={17} />} label="Boldness">
                    <SettingsSelect
                      ariaLabel="Text boldness"
                      value={textWeight}
                      disabled={!onTextWeightChange}
                      onChange={(value) => onTextWeightChange?.(value as QuizTextWeight)}
                    >
                      {(Object.keys(TEXT_WEIGHT_LABELS) as QuizTextWeight[]).map((weight) => (
                        <option key={weight} value={weight}>{TEXT_WEIGHT_LABELS[weight]}</option>
                      ))}
                    </SettingsSelect>
                  </SettingsRow>

                  <SettingsRow icon={<List size={17} />} label="Spacing">
                    <SettingsSelect
                      ariaLabel="Spacing"
                      value={spacing}
                      disabled={!onSpacingChange}
                      onChange={(value) => onSpacingChange?.(value as QuizSpacing)}
                    >
                      <option value="comfortable">Comfort</option>
                      <option value="compact">Compact</option>
                    </SettingsSelect>
                  </SettingsRow>
                </section>

                <section className="ios-settings-group" aria-label="Display and features">
                  <SettingsRow icon={isDark ? <Moon size={17} /> : <Sun size={17} />} label="Dark theme">
                    <SwitchToggle
                      checked={isDark}
                      onChange={onToggleTheme}
                      label="Theme"
                      ariaLabel="Toggle dark/light theme"
                    />
                  </SettingsRow>
                  <SettingsRow icon={<ListOrdered size={17} />} label="Hide question strip">
                    <SwitchToggle
                      checked={hideQuestionNumbers}
                      onChange={onToggleHideQuestionNumbers}
                      label="Hide Question Numbers"
                      ariaLabel="Toggle hide question numbers row"
                    />
                  </SettingsRow>
                </section>

                <section className="ios-settings-group ios-settings-visibility" aria-label="Tool visibility">
                  <h3 className="ios-settings-section-title">Hide Tools</h3>
                  <div className="ios-settings-tool-options" role="group" aria-label="Hide quiz tools">
                    <button type="button" className="ios-settings-tool-btn" title="Hide solution" aria-label="Toggle hide view solution" aria-pressed={hideViewSolution} onClick={() => onToggleHideViewSolution(!hideViewSolution)}>
                      <FileText size={20} aria-hidden="true" /><span className="sr-only">Solution</span>
                    </button>
                    <button type="button" className="ios-settings-tool-btn" title="Hide AI tutor" aria-label="Toggle hide AI tutor" aria-pressed={hideAiTutor} onClick={() => onToggleHideAiTutor(!hideAiTutor)}>
                      <Bot size={20} aria-hidden="true" /><span className="sr-only">AI tutor</span>
                    </button>
                    <button type="button" className="ios-settings-tool-btn" title="Hide both" aria-label="Toggle hide both Solution and AI Tutor" aria-pressed={hideBoth} onClick={() => onToggleHideBoth(!hideBoth)}>
                      <Layers size={20} aria-hidden="true" /><span className="sr-only">Both</span>
                    </button>
                  </div>
                </section>
              </div>

              {onLeaveQuiz && (
                <button
                  type="button"
                  className="ios-settings-leave-btn"
                  onClick={onLeaveQuiz}
                >
                  <LogOut size={17} aria-hidden="true" />
                  Leave quiz
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .ios-settings-backdrop {
          position: fixed;
          inset: 0;
          z-index: 998;
          background: rgba(0, 0, 0, 0.42);
          will-change: opacity;
        }

        /* Theme tokens: mirror the quiz engine surfaces (OLED dark / light exam palette). */
        .ios-settings-popover[data-theme="dark"] {
          --qs-surface: var(--oled-surface, #1c1c1e);
          --qs-control: var(--oled-inset, #29292c);
          --qs-control-hover: var(--oled-hover, #252527);
          --qs-text: var(--oled-text, #e5eaf0);
          --qs-secondary: var(--oled-secondary, #a2a9b4);
          --qs-border: rgb(255 255 255 / 8%);
          --qs-accent: var(--oled-selected, #0a84ff);
          --qs-accent-text: #edf4fc;
          --qs-leave-bg: var(--oled-selected-soft, rgb(10 132 255 / 16%));
          --qs-leave-border: color-mix(in srgb, var(--qs-accent) 32%, transparent);
          --qs-leave-text: #79b8ff;
          --qs-switch-off: var(--oled-inset, #29292c);
          --qs-shadow: 0 20px 48px rgb(0 0 0 / 55%), 0 0 0 1px rgb(255 255 255 / 7%);
        }
        .ios-settings-popover[data-theme="light"] {
          --qs-surface: var(--light-surface, #ffffff);
          --qs-control: var(--light-surface-muted, #edf1f6);
          --qs-control-hover: var(--light-canvas, #f5f7fa);
          --qs-text: var(--light-text, #182438);
          --qs-secondary: var(--light-text-secondary, #526176);
          --qs-border: var(--light-border, #dce3ec);
          --qs-accent: var(--light-accent, #007aff);
          --qs-accent-text: #ffffff;
          --qs-leave-bg: var(--light-accent-soft, rgb(0 122 255 / 12%));
          --qs-leave-border: color-mix(in srgb, var(--qs-accent) 28%, transparent);
          --qs-leave-text: var(--light-accent, #007aff);
          --qs-switch-off: #d9dee6;
          --qs-shadow: 0 14px 36px rgb(15 23 42 / 15%), 0 0 0 1px rgb(0 0 0 / 4%);
        }

        .ios-settings-popover {
          position: fixed;
          top: calc(env(safe-area-inset-top) + 52px);
          left: 12px;
          width: calc(100% - 24px);
          max-width: 288px;
          max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 64px);
          overflow-y: auto;
          overscroll-behavior: contain;
          z-index: 999;
          box-sizing: border-box;
          border-radius: 20px;
          padding: 0 0 12px;
          background: var(--qs-surface);
          color: var(--qs-text);
          border: 1px solid var(--qs-border);
          box-shadow: var(--qs-shadow);
          transform-origin: top left;
          will-change: transform, opacity;
        }
        .mac-series-quiz .ios-settings-popover {
          left: auto;
          right: 16px;
          transform-origin: top right;
        }

        .ios-settings-header {
          position: sticky;
          top: 0;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 12px 10px 16px;
          background: var(--qs-surface);
          border-bottom: 1px solid var(--qs-border);
        }
        .ios-settings-title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }
        .ios-settings-close-btn {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--qs-secondary);
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .ios-settings-close-btn:hover { background: var(--qs-control); color: var(--qs-text); }

        .ios-settings-list {
          display: flex;
          flex-direction: column;
          padding: 0 14px 0 16px;
        }
        .ios-settings-group {
          display: flex;
          flex-direction: column;
          padding: 4px 0;
        }
        .ios-settings-group + .ios-settings-group { border-top: 1px solid var(--qs-border); }

        .ios-settings-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 40px;
        }
        .ios-settings-item-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .ios-settings-icon-box {
          display: grid;
          place-items: center;
          width: 20px;
          flex-shrink: 0;
          color: var(--qs-secondary);
        }
        .ios-settings-label {
          font-size: 13.5px;
          font-weight: 500;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Pill dropdown */
        .ios-settings-select {
          position: relative;
          display: inline-flex;
          flex: 0 0 98px;
        }
        .ios-settings-select select {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          height: 32px;
          padding: 0 26px 0 12px;
          border: 1px solid var(--qs-border);
          border-radius: 999px;
          background: var(--qs-control);
          color: var(--qs-text);
          font: inherit;
          font-size: 12.5px;
          font-weight: 500;
          text-align: center;
          text-align-last: center;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .ios-settings-select select:hover:enabled { border-color: var(--qs-accent); }
        .ios-settings-select select:focus-visible { outline: 2px solid var(--qs-accent); outline-offset: 2px; }
        .ios-settings-select select:disabled { opacity: 0.45; cursor: not-allowed; }
        .ios-settings-select select option { background: var(--qs-surface); color: var(--qs-text); }
        .ios-settings-select-chevron {
          position: absolute;
          right: 10px;
          top: 50%;
          translate: 0 -50%;
          pointer-events: none;
          color: var(--qs-secondary);
        }

        /* Switch */
        .ios-settings-switch {
          position: relative;
          flex-shrink: 0;
          width: 44px;
          height: 26px;
          padding: 2px;
          border: 0;
          border-radius: 999px;
          background: var(--qs-switch-off);
          cursor: pointer;
          transition: background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ios-settings-switch.is-active { background: var(--qs-accent); }
        .ios-settings-switch:focus-visible { outline: 2px solid var(--qs-accent); outline-offset: 2px; }
        .ios-settings-switch-thumb {
          display: block;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ios-settings-switch.is-active .ios-settings-switch-thumb { transform: translateX(18px); }

        /* Hide tools */
        .ios-settings-visibility { padding-top: 8px; }
        .ios-settings-section-title {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 500;
          color: var(--qs-secondary);
        }
        .ios-settings-tool-options {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .ios-settings-tool-btn {
          display: grid;
          place-items: center;
          height: 50px;
          padding: 0;
          border: 1px solid var(--qs-border);
          border-radius: 14px;
          background: var(--qs-control);
          color: var(--qs-text);
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .ios-settings-tool-btn:hover { border-color: var(--qs-accent); }
        .ios-settings-tool-btn:focus-visible { outline: 2px solid var(--qs-accent); outline-offset: 2px; }
        .ios-settings-tool-btn[aria-pressed="true"] {
          background: var(--qs-accent);
          border-color: var(--qs-accent);
          color: var(--qs-accent-text);
        }

        /* Leave quiz */
        .ios-settings-leave-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: calc(100% - 28px);
          min-height: 44px;
          margin: 10px 14px 0;
          border: 1px solid var(--qs-leave-border);
          border-radius: 999px;
          background: var(--qs-leave-bg);
          color: var(--qs-leave-text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .ios-settings-leave-btn:hover { border-color: var(--qs-accent); }
        .ios-settings-leave-btn:focus-visible { outline: 2px solid var(--qs-accent); outline-offset: 2px; }
      `}</style>
    </>
  );
}

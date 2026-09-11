"use client";

import React, { useEffect } from "react";
import {
  Settings,
  Sun,
  Moon,
  X,
  Bot,
  ListOrdered,
  FileText,
  Layers,
} from "lucide-react";
import type { QuizTheme } from "../types";

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

function SwitchToggle({ checked, onChange, label, ariaLabel }: SwitchToggleProps) {
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
  theme: QuizTheme;
  onToggleTheme: () => void;
  hideQuestionNumbers: boolean;
  onToggleHideQuestionNumbers: (val: boolean) => void;
  hideViewSolution: boolean;
  onToggleHideViewSolution: (val: boolean) => void;
  hideAiTutor: boolean;
  onToggleHideAiTutor: (val: boolean) => void;
  onToggleHideBoth: (val: boolean) => void;
}

export function QuizSettingsModal({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  hideQuestionNumbers,
  onToggleHideQuestionNumbers,
  hideViewSolution,
  onToggleHideViewSolution,
  hideAiTutor,
  onToggleHideAiTutor,
  onToggleHideBoth,
}: QuizSettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDark = theme === "dark";
  const hideBoth = hideViewSolution && hideAiTutor;

  return (
    <>
      <div
        className="ios-settings-backdrop"
        onClick={onClose}
        aria-hidden="true"
        data-testid="settings-backdrop"
      />
      <div
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
          {/* Theme Row */}
          <div className="ios-settings-item">
            <div className="ios-settings-item-left">
              <div className="ios-settings-icon-box theme-icon">
                {isDark ? <Moon size={15} /> : <Sun size={15} />}
              </div>
              <div className="ios-settings-label-wrap">
                <span className="ios-settings-label">Dark Theme</span>
                <span className="ios-settings-sublabel">
                  {isDark ? "Dark mode active" : "Light mode active"}
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

          {/* Hide View Solution */}
          <div className="ios-settings-item">
            <div className="ios-settings-item-left">
              <div className="ios-settings-icon-box solution-icon">
                <FileText size={15} />
              </div>
              <div className="ios-settings-label-wrap">
                <span className="ios-settings-label">Hide View Solution</span>
                <span className="ios-settings-sublabel">Hide solution button</span>
              </div>
            </div>
            <SwitchToggle
              checked={hideViewSolution}
              onChange={onToggleHideViewSolution}
              label="Hide View Solution"
              ariaLabel="Toggle hide view solution"
            />
          </div>

          <div className="ios-settings-divider" />

          {/* Hide AI Tutor */}
          <div className="ios-settings-item">
            <div className="ios-settings-item-left">
              <div className="ios-settings-icon-box tutor-icon">
                <Bot size={15} />
              </div>
              <div className="ios-settings-label-wrap">
                <span className="ios-settings-label">Hide AI Tutor</span>
                <span className="ios-settings-sublabel">Hide Ask AI Tutor button</span>
              </div>
            </div>
            <SwitchToggle
              checked={hideAiTutor}
              onChange={onToggleHideAiTutor}
              label="Hide AI Tutor"
              ariaLabel="Toggle hide AI tutor"
            />
          </div>

          <div className="ios-settings-divider" />

          {/* Hide Both (Solution & AI Tutor) */}
          <div className="ios-settings-item">
            <div className="ios-settings-item-left">
              <div className="ios-settings-icon-box both-icon">
                <Layers size={15} />
              </div>
              <div className="ios-settings-label-wrap">
                <span className="ios-settings-label">Hide Both</span>
                <span className="ios-settings-sublabel">Hide Solution & AI Tutor</span>
              </div>
            </div>
            <SwitchToggle
              checked={hideBoth}
              onChange={onToggleHideBoth}
              label="Hide Both"
              ariaLabel="Toggle hide both Solution and AI Tutor"
            />
          </div>
        </div>
      </div>

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
          max-width: 320px;
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
        .ios-settings-popover[data-theme="dark"] {
          background: var(--dark-surface);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: var(--light-canvas);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
        }

        /* Light Theme Popover */
        .ios-series-quiz[data-theme="light"] .ios-settings-popover,
        .ios-settings-popover[data-theme="light"] {
          background: #ffffff;
          border: 1px solid var(--light-border);
          color: var(--light-text);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04);
        }

        .ios-settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
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

        .ios-settings-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 0;
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
          opacity: 0.6;
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

        /* iOS Switch */
        .ios-settings-switch {
          position: relative;
          width: 42px;
          height: 24px;
          border-radius: 12px;
          border: none;
          padding: 2px;
          background: #39393d;
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
      `}</style>
    </>
  );
}

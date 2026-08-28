"use client";

import React, { useEffect } from "react";
import {
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
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 30 30"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M 15 2 C 14.448 2 14 2.448 14 3 L 14 3.171875 C 14 3.649875 13.663406 4.0763437 13.191406 4.1523438 C 12.962406 4.1893437 12.735719 4.2322031 12.511719 4.2832031 C 12.047719 4.3892031 11.578484 4.1265 11.396484 3.6875 L 11.330078 3.53125 C 11.119078 3.02125 10.534437 2.7782344 10.023438 2.9902344 C 9.5134375 3.2012344 9.2704219 3.785875 9.4824219 4.296875 L 9.5488281 4.4570312 C 9.7328281 4.8970313 9.5856875 5.4179219 9.1796875 5.6699219 C 8.9836875 5.7919219 8.7924688 5.9197344 8.6054688 6.0527344 C 8.2174688 6.3297344 7.68075 6.2666875 7.34375 5.9296875 L 7.2226562 5.8085938 C 6.8316562 5.4175937 6.1985937 5.4175938 5.8085938 5.8085938 C 5.4185938 6.1995938 5.4185938 6.8326563 5.8085938 7.2226562 L 5.9296875 7.34375 C 6.2666875 7.68075 6.3297344 8.2164688 6.0527344 8.6054688 C 5.9197344 8.7924687 5.7919219 8.9836875 5.6699219 9.1796875 C 5.4179219 9.5856875 4.8960781 9.7337812 4.4550781 9.5507812 L 4.296875 9.484375 C 3.786875 9.273375 3.2002813 9.5153906 2.9882812 10.025391 C 2.7772813 10.535391 3.0192969 11.120031 3.5292969 11.332031 L 3.6855469 11.396484 C 4.1245469 11.578484 4.3892031 12.047719 4.2832031 12.511719 C 4.2322031 12.735719 4.1873906 12.962406 4.1503906 13.191406 C 4.0753906 13.662406 3.649875 14 3.171875 14 L 3 14 C 2.448 14 2 14.448 2 15 C 2 15.552 2.448 16 3 16 L 3.171875 16 C 3.649875 16 4.0763437 16.336594 4.1523438 16.808594 C 4.1893437 17.037594 4.2322031 17.264281 4.2832031 17.488281 C 4.3892031 17.952281 4.1265 18.421516 3.6875 18.603516 L 3.53125 18.669922 C 3.02125 18.880922 2.7782344 19.465563 2.9902344 19.976562 C 3.2012344 20.486563 3.785875 20.729578 4.296875 20.517578 L 4.4570312 20.451172 C 4.8980312 20.268172 5.418875 20.415312 5.671875 20.820312 C 5.793875 21.016313 5.9206875 21.208484 6.0546875 21.396484 C 6.3316875 21.784484 6.2686406 22.321203 5.9316406 22.658203 L 5.8085938 22.779297 C 5.4175937 23.170297 5.4175938 23.803359 5.8085938 24.193359 C 6.1995938 24.583359 6.8326562 24.584359 7.2226562 24.193359 L 7.3457031 24.072266 C 7.6827031 23.735266 8.2174688 23.670266 8.6054688 23.947266 C 8.7934688 24.081266 8.9856406 24.210031 9.1816406 24.332031 C 9.5866406 24.584031 9.7357344 25.105875 9.5527344 25.546875 L 9.4863281 25.705078 C 9.2753281 26.215078 9.5173438 26.801672 10.027344 27.013672 C 10.537344 27.224672 11.121984 26.982656 11.333984 26.472656 L 11.398438 26.316406 C 11.580438 25.877406 12.049672 25.61275 12.513672 25.71875 C 12.737672 25.76975 12.964359 25.814562 13.193359 25.851562 C 13.662359 25.924562 14 26.350125 14 26.828125 L 14 27 C 14 27.552 14.448 28 15 28 C 15.552 28 16 27.552 16 27 L 16 26.828125 C 16 26.350125 16.336594 25.923656 16.808594 25.847656 C 17.037594 25.810656 17.264281 25.767797 17.488281 25.716797 C 17.952281 25.610797 18.421516 25.8735 18.603516 26.3125 L 18.669922 26.46875 C 18.880922 26.97875 19.465563 27.221766 19.976562 27.009766 C 20.486563 26.798766 20.729578 26.214125 20.517578 25.703125 L 20.451172 25.542969 C 20.268172 25.101969 20.415312 24.581125 20.820312 24.328125 C 21.016313 24.206125 21.208484 24.079312 21.396484 23.945312 C 21.784484 23.668312 22.321203 23.731359 22.658203 24.068359 L 22.779297 24.191406 C 23.170297 24.582406 23.803359 24.582406 24.193359 24.191406 C 24.583359 23.800406 24.584359 23.167344 24.193359 22.777344 L 24.072266 22.654297 C 23.735266 22.317297 23.670266 21.782531 23.947266 21.394531 C 24.081266 21.206531 24.210031 21.014359 24.332031 20.818359 C 24.584031 20.413359 25.105875 20.264266 25.546875 20.447266 L 25.705078 20.513672 C 26.215078 20.724672 26.801672 20.482656 27.013672 19.972656 C 27.224672 19.462656 26.982656 18.878016 26.472656 18.666016 L 26.316406 18.601562 C 25.877406 18.419563 25.61275 17.950328 25.71875 17.486328 C 25.76975 17.262328 25.814562 17.035641 25.851562 16.806641 C 25.924562 16.337641 26.350125 16 26.828125 16 L 27 16 C 27.552 16 28 15.552 28 15 C 28 14.448 27.552 14 27 14 L 26.828125 14 C 26.350125 14 25.923656 13.663406 25.847656 13.191406 C 25.810656 12.962406 25.767797 12.735719 25.716797 12.511719 C 25.610797 12.047719 25.8735 11.578484 26.3125 11.396484 L 26.46875 11.330078 C 26.97875 11.119078 27.221766 10.534437 27.009766 10.023438 C 26.798766 9.5134375 26.214125 9.2704219 25.703125 9.4824219 L 25.542969 9.5488281 C 25.101969 9.7318281 24.581125 9.5846875 24.328125 9.1796875 C 24.206125 8.9836875 24.079312 8.7915156 23.945312 8.6035156 C 23.668312 8.2155156 23.731359 7.6787969 24.068359 7.3417969 L 24.191406 7.2207031 C 24.582406 6.8297031 24.582406 6.1966406 24.191406 5.8066406 C 23.800406 5.4156406 23.167344 5.4156406 22.777344 5.8066406 L 22.65625 5.9296875 C 22.31925 6.2666875 21.782531 6.3316875 21.394531 6.0546875 C 21.206531 5.9206875 21.014359 5.7919219 20.818359 5.6699219 C 20.413359 5.4179219 20.266219 4.8960781 20.449219 4.4550781 L 20.515625 4.296875 C 20.726625 3.786875 20.484609 3.2002812 19.974609 2.9882812 C 19.464609 2.7772813 18.879969 3.0192969 18.667969 3.5292969 L 18.601562 3.6855469 C 18.419563 4.1245469 17.950328 4.3892031 17.486328 4.2832031 C 17.262328 4.2322031 17.035641 4.1873906 16.806641 4.1503906 C 16.336641 4.0753906 16 3.649875 16 3.171875 L 16 3 C 16 2.448 15.552 2 15 2 z M 15 7 C 19.078645 7 22.438586 10.054876 22.931641 14 L 16.728516 14 A 2 2 0 0 0 15 13 A 2 2 0 0 0 14.998047 13 L 11.896484 7.625 C 12.850999 7.222729 13.899211 7 15 7 z M 10.169922 8.6328125 L 13.269531 14 A 2 2 0 0 0 13 15 A 2 2 0 0 0 13.269531 15.996094 L 10.167969 21.365234 C 8.2464258 19.903996 7 17.600071 7 15 C 7 12.398945 8.2471371 10.093961 10.169922 8.6328125 z M 16.730469 16 L 22.931641 16 C 22.438586 19.945124 19.078645 23 15 23 C 13.899211 23 12.850999 22.777271 11.896484 22.375 L 14.998047 17 A 2 2 0 0 0 15 17 A 2 2 0 0 0 16.730469 16 z" />
    </svg>
  );
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
        <div className="ios-settings-header">
          <div className="ios-settings-title-group">
            <span className="ios-settings-title">Quiz Settings</span>
          </div>
          <button
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
          background: #1c1c1e;
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #f2f2f7;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
        }

        /* Light Theme Popover */
        .ios-series-quiz[data-theme="light"] .ios-settings-popover,
        .ios-settings-popover[data-theme="light"] {
          background: #ffffff;
          border: 1px solid #E6EAEF;
          color: #1d1d1f;
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
          border-bottom-color: #E6EAEF;
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
          background: #F6F8FA;
          color: #57606a;
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

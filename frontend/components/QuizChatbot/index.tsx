"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import { Sun, Moon, X, Plus, Mic, Send, Zap, CheckCircle2, FileText, AlertTriangle, Sparkles } from "lucide-react";
import api from '@/lib/axios';
import { API, ChatMessage, QuizChatbotQuestion, QuizChatbotProps, resolveCorrectAnswer, buildQuestionContext, normalizeTutorMarkdown } from './utils';

export default function QuizChatbot({
  isVisible,
  questionNumber,
  topicTitle,
  question,
  theme,
  renderTrigger,
}: QuizChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(theme === "dark");

  useEffect(() => {
    if (theme) {
      setIsDark(theme === "dark");
    }
  }, [theme]);

  const [isChatView, setIsChatView] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const context = useMemo(
    () => buildQuestionContext(questionNumber, topicTitle, question),
    [question, questionNumber, topicTitle]
  );

  useEffect(() => {
    if (!isChatView) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isLoading, isChatView]);

  if (!isVisible || !question) return null;

  async function sendMessage(nextText?: string) {
    const text = (nextText ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const response = await api.post(
        '/api/ai/tutor-chat',
        {
          context,
          message: text,
        },
        {
          timeout: 60000,
        }
      );

      const reply =
        response.data?.reply ||
        response.data?.explanation ||
        "I could not generate a response. Please try again.";
      setMessages((prev) => [...prev, { role: "bot", content: reply }]);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.error ||
        err?.message ||
        "I could not reach the tutor service. Check the backend connection and try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const landingOptions = [
    {
      title: "Explain the step-by-step solution",
      subtitle: "Get a clear, detailed solution in steps.",
      prompt: "Explain the step-by-step solution",
      tone: "g",
      icon: <Zap className="w-5 h-5 shrink-0" />,
    },
    {
      title: "Why is the correct option right?",
      subtitle: "Understand the logic and reasoning.",
      prompt: "Why is the correct option right?",
      tone: "o",
      icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
    },
    {
      title: "Give me a similar practice question",
      subtitle: "Practice with a similar type of question.",
      prompt: "Give me a similar practice question",
      tone: "p",
      icon: <FileText className="w-5 h-5 shrink-0" />,
    },
    {
      title: "What trap should I avoid?",
      subtitle: "Learn common mistakes and how to avoid them.",
      prompt: "What trap should I avoid?",
      tone: "b",
      icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
    },
    {
      title: "What is the fastest shortcut?",
      subtitle: "Get quick tricks to solve faster.",
      prompt: "What is the fastest shortcut?",
      tone: "y",
      icon: <Sparkles className="w-5 h-5 shrink-0" />,
    },
  ];

  const followUps = [
    {
      label: "What is the fastest shortcut?",
      prompt: "What is the fastest shortcut?",
      icon: <Sparkles className="w-4 h-4 shrink-0" />,
    },
    {
      label: "Give me a similar practice question",
      prompt: "Give me a similar practice question",
      icon: <FileText className="w-4 h-4 shrink-0" />,
    },
    {
      label: "What trap should I avoid?",
      prompt: "What trap should I avoid?",
      icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
    },
  ];

  const hasInput = input.trim().length > 0;

  const handleSend = () => {
    if (!hasInput || isLoading) return;
    if (!isChatView) setIsChatView(true);
    sendMessage();
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      setCopiedIndex(null);
    }
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setIsOpen(true))
      ) : (
        <button
          type="button"
          className="quiz-chatbot-fab"
          onClick={() => setIsOpen(true)}
          title="Ask AI Tutor"
          aria-label="Ask AI Tutor"
        >
          <svg className="fab-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 14.05 2.63 15.96 3.7 17.54L2.29 21.71L6.46 20.3C8.04 21.37 9.95 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
              fill="white"
              fillOpacity="0.95"
            />
            <circle cx="8.5" cy="12" r="1.3" fill="#7c6df0" />
            <circle cx="12" cy="12" r="1.3" fill="#7c6df0" />
            <circle cx="15.5" cy="12" r="1.3" fill="#7c6df0" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div
          className="quiz-chatbot-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            className="quiz-chatbot-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-chatbot-title"
          >
            <div className={`quiz-chatbot-shell${isDark ? " dark" : ""}`}>
              <div className="mobile-sheet-handle" aria-hidden="true" />
              <div className="topbar">
                <button type="button" className="hbtn" aria-label="Open menu">
                  <span />
                  <span />
                  <span />
                </button>
                <div id="quiz-chatbot-title" className="logo">AI Tutor</div>
                <div className="top-actions">
                  <button
                    type="button"
                    className="dmbtn"
                    onClick={() => setIsDark((prev) => !prev)}
                    title="Toggle dark mode"
                    aria-label="Toggle dark mode"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Moon className="w-4 h-4 text-sky-500 shrink-0" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="closebtn"
                    onClick={() => setIsOpen(false)}
                    title="Close"
                    aria-label="Close"
                  >
                    <X className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-300 shrink-0" />
                  </button>
                </div>
              </div>

              <div className="views">
                <div className={`land${isChatView ? " out" : ""}`}>
                  <div className="lscroll">
                    <div className="ctx">
                      <div className="ctxi">Q</div>
                      <div>
                        <div className="ctxl">
                          Context loaded:{" "}
                          <span>
                            Q{questionNumber} · {question.concept || topicTitle}
                            {question.exam ? ` · ${question.exam}` : ""}
                          </span>
                        </div>
                        <div className="ctxs">
                          Ask anything about this submitted question.
                        </div>
                      </div>
                    </div>

                    <div className="ltitle">What can I help with?</div>
                    <div className="opts">
                      {landingOptions.map((option) => (
                        <button
                          key={option.title}
                          type="button"
                          className="opt"
                          onClick={() => {
                            if (!isChatView) setIsChatView(true);
                            sendMessage(option.prompt);
                          }}
                          disabled={isLoading}
                        >
                          <div className={`oi ${option.tone}`}>{option.icon}</div>
                          <div>
                            <span className="ot">{option.title}</span>
                            <span className="os">{option.subtitle}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`chat${isChatView ? " show in" : ""}`}>
                  <div className="ca" ref={scrollRef}>
                    {messages.length > 0 && <div className="chat-divider">Start of conversation</div>}
                    {messages.map((message, index) => {
                      if (message.role === "user") {
                        return (
                          <div className="mu" key={`${message.role}-${index}`}>
                            {message.content}
                          </div>
                        );
                      }

                      return (
                        <div className="ma" key={`${message.role}-${index}`}>
                          <div className="sb">
                            <div className="sh2">
                              <span className="slbl2">Solution</span>
                              <button
                                type="button"
                                className="cpb"
                                onClick={() => handleCopy(message.content, index)}
                              >
                                {copiedIndex === index ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <div className="sdiv" />
                            <div className="sbody">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath, remarkGfm]}
                                rehypePlugins={[
                                  [
                                    rehypeKatex,
                                    {
                                      throwOnError: false,
                                      strict: "ignore",
                                      trust: false,
                                    },
                                  ],
                                ]}
                                components={{
                                  table: ({ node, ...props }) => (
                                    <div className="table-wrapper">
                                      <table {...props} />
                                    </div>
                                  ),
                                  th: ({ node, ...props }) => <th {...props} />,
                                  td: ({ node, ...props }) => <td {...props} />,
                                }}
                              >
                                {normalizeTutorMarkdown(message.content)}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <div className="swrap">
                            <div className="swlbl">Continue exploring</div>
                            <div className="swlist">
                              {followUps.map((followUp) => (
                                <button
                                  key={followUp.label}
                                  type="button"
                                  className="chip"
                                  onClick={() => sendMessage(followUp.prompt)}
                                  disabled={isLoading}
                                >
                                  <div className="chipl">
                                    <span>{followUp.icon}</span>
                                    {followUp.label}
                                  </div>
                                  <span className="chipa">›</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className={`typing${isLoading ? "" : " hidden"}`}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <div style={{ height: 12 }} />
                  </div>

                  <div className="bbar">
                    <div className="irow">
                      <button type="button" className="addb" aria-label="Attach context">
                        <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                      </button>
                      <input
                        className="ci"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Ask AI Tutor"
                        autoComplete="off"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        className="mic"
                        aria-label="Voice input"
                        style={{ display: hasInput ? "none" : "flex" }}
                      >
                        <Mic className="w-4.5 h-4.5 text-white shrink-0" />
                      </button>
                      <button
                        type="button"
                        className={`snd${hasInput ? " on" : ""}`}
                        onClick={handleSend}
                        aria-label="Send message"
                        disabled={isLoading || !hasInput}
                      >
                        <Send className="w-4 h-4 text-white shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {!isChatView && (
                <div className="bbar lbar">
                  <div className="irow">
                    <button type="button" className="addb" aria-label="Attach context">
                      <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                    </button>
                    <input
                      className="ci"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask AI Tutor"
                      autoComplete="off"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="mic"
                      aria-label="Voice input"
                      style={{ display: hasInput ? "none" : "flex" }}
                    >
                      <Mic className="w-4.5 h-4.5 text-white shrink-0" />
                    </button>
                    <button
                      type="button"
                      className={`snd${hasInput ? " on" : ""}`}
                      onClick={handleSend}
                      aria-label="Send message"
                      disabled={isLoading || !hasInput}
                    >
                      <Send className="w-4 h-4 text-white shrink-0" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        .quiz-chatbot-fab {
          position: fixed;
          bottom: 92px;
          right: 24px;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #7c6df0 0%, #f07c6d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(124, 109, 240, 0.45);
          position: fixed;
          z-index: 500;
          animation: fabPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .quiz-chatbot-fab:hover { transform: scale(1.08); }

        .quiz-chatbot-fab::before {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c6df0 0%, #f07c6d 100%);
          opacity: 0.36;
          animation: pulse 2s ease-out infinite;
        }
        .quiz-chatbot-fab::after {
          content: '';
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #fff;
          top: 6px;
          right: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          animation: orbit 3s linear infinite;
        }

        .fab-icon { width: 32px; height: 32px; position: relative; z-index: 1; }

        @keyframes fabPop { from { transform: scale(0) rotate(-20deg); opacity: 0; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.36; } 80% { transform: scale(1.9); opacity: 0; } 100% { opacity: 0; } }
        @keyframes orbit { 0% { transform: rotate(0deg) translateX(26px); } 100% { transform: rotate(360deg) translateX(26px); } }
        .quiz-chatbot-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.38);
          backdrop-filter: blur(6px);
          z-index: 600;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .quiz-chatbot-modal {
          width: min(100vw, 480px);
          max-width: 100vw;
          height: min(100vh, 760px);
          height: min(100svh, 760px);
          height: min(100dvh, 760px);
          max-height: 100dvh;
          border-radius: 20px 20px 0 0;
          overflow: hidden;
          box-shadow: 0 -18px 48px rgba(15, 23, 42, 0.28);
        }
        .mobile-sheet-handle { display: none; }
        .quiz-chatbot-shell {
          --or: #007aff;
          --orl: rgba(0, 122, 255, 0.08);
          --orm: rgba(0, 122, 255, 0.22);
          --pu: #007aff;
          --pul: rgba(0, 122, 255, 0.08);
          --dk: #1d1d1f;
          --gr: rgba(60, 60, 67, 0.6);
          --grl: #f2f2f7;
          --bd: rgba(0, 0, 0, 0.08);
          --wh: #ffffff;
          --bg: #ffffff;
          --sh: 0 4px 24px rgba(0, 0, 0, 0.06);
          --sbody-c: #1d1d1f;
          --ares-bg: rgba(0, 122, 255, 0.06);
          --irow-bg: #f2f2f7;
          background: var(--bg);
          color: var(--dk);
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
          transition: background 0.35s, color 0.35s;
        }
        .quiz-chatbot-shell.dark {
          --or: #0a84ff;
          --orl: rgba(10, 132, 255, 0.15);
          --orm: rgba(10, 132, 255, 0.35);
          --pu: #0a84ff;
          --pul: rgba(10, 132, 255, 0.15);
          --dk: #ffffff;
          --gr: rgba(235, 235, 245, 0.6);
          --grl: #2c2c2e;
          --bd: rgba(255, 255, 255, 0.14);
          --wh: #242426;
          --bg: #1c1c1e;
          --sh: 0 4px 30px rgba(0, 0, 0, 0.4);
          --sbody-c: #ebebf5;
          --ares-bg: rgba(10, 132, 255, 0.12);
          --irow-bg: #242426;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: calc(10px + env(safe-area-inset-top)) 18px 12px;
          background: var(--bg);
          border-bottom: 0.5px solid var(--bd);
          flex-shrink: 0;
          transition: background 0.35s, border-color 0.35s;
        }
        .top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .closebtn {
          width: 34px !important;
          height: 34px !important;
          aspect-ratio: 1;
          border-radius: 50% !important;
          border: 1px solid var(--bd);
          background: var(--grl);
          cursor: pointer;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          transition: all 0.15s ease;
          flex-shrink: 0 !important;
        }
        .closebtn:hover {
          background: var(--or);
          color: #ffffff;
          border-color: transparent;
        }
        .logo {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.3px;
          color: var(--dk);
          transition: color 0.35s;
        }
        .hbtn {
          display: none;
        }
        .dmbtn {
          width: 34px !important;
          height: 34px !important;
          aspect-ratio: 1;
          border-radius: 50% !important;
          border: 1px solid var(--bd);
          background: var(--grl);
          cursor: pointer;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          transition: all 0.15s ease;
          flex-shrink: 0 !important;
        }
        .dmbtn:hover {
          background: var(--orm);
        }
        .views {
          flex: 1;
          min-height: 0;
          position: relative;
          background: var(--wh);
        }
        .land,
        .chat {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          background: var(--wh);
          transition: opacity 0.3s, transform 0.3s, background 0.35s;
          min-height: 0;
        }
        .land.out {
          opacity: 0;
          transform: translateY(-14px);
          pointer-events: none;
        }
        .lscroll {
          flex: 1;
          overflow-y: auto;
          padding-bottom: 8px;
        }
        .lscroll::-webkit-scrollbar {
          width: 4px;
        }
        .lscroll::-webkit-scrollbar-thumb {
          background: var(--bd);
          border-radius: 4px;
        }
        .ctx {
          margin: 16px 16px 0;
          background: var(--wh);
          border: 1px solid var(--bd);
          border-radius: 16px;
          padding: 14px 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          box-shadow: var(--sh);
          transition: background 0.35s, border-color 0.35s;
        }
        .ctxi {
          width: 38px;
          height: 38px;
          background: var(--pu);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
          transition: background 0.35s;
        }
        .ctxl {
          font-size: 13px;
          font-weight: 600;
          color: var(--pu);
          margin-bottom: 2px;
          transition: color 0.35s;
        }
        .ctxl span {
          color: var(--dk);
          font-weight: 400;
          transition: color 0.35s;
        }
        .ctxs {
          font-size: 12px;
          color: var(--gr);
          margin-top: 2px;
        }
        .ltitle {
          text-align: center;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.5px;
          padding: 28px 20px 20px;
          color: var(--dk);
          transition: color 0.35s;
        }
        .opts {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 16px 20px;
        }
        .opt {
          background: var(--wh);
          border: 1px solid var(--bd);
          border-radius: 16px;
          padding: 15px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
          transition: background 0.15s, transform 0.12s, box-shadow 0.15s,
            border-color 0.35s;
          box-shadow: var(--sh);
          text-align: left;
          width: 100%;
        }
        .opt:hover {
          background: var(--grl);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        }
        .opt:active {
          transform: scale(0.98);
        }
        .oi {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          transition: background 0.35s;
        }
        .g {
          background: rgba(52, 199, 89, 0.14);
          color: #248a3d;
        }
        .o {
          background: rgba(255, 149, 0, 0.14);
          color: #b45309;
        }
        .p {
          background: rgba(175, 82, 222, 0.14);
          color: #8028a0;
        }
        .b {
          background: rgba(0, 122, 255, 0.14);
          color: #0060df;
        }
        .y {
          background: rgba(255, 204, 0, 0.18);
          color: #a16207;
        }
        .dark .g {
          background: rgba(48, 209, 88, 0.18);
          color: #30d158;
        }
        .dark .o {
          background: rgba(255, 159, 10, 0.18);
          color: #ff9f0a;
        }
        .dark .p {
          background: rgba(191, 90, 242, 0.18);
          color: #bf5af2;
        }
        .dark .b {
          background: rgba(10, 132, 255, 0.18);
          color: #0a84ff;
        }
        .dark .y {
          background: rgba(255, 214, 10, 0.18);
          color: #ffd60a;
        }
        .ot {
          font-size: 14.5px;
          font-weight: 700;
          color: var(--dk);
          margin-bottom: 2px;
          display: block;
          transition: color 0.35s;
        }
        .os {
          font-size: 12px;
          color: var(--gr);
        }
        .bbar {
          flex-shrink: 0;
          background: var(--wh);
          padding: 10px 14px calc(18px + env(safe-area-inset-bottom));
          border-top: 1px solid var(--bd);
          transition: opacity 0.3s, background 0.35s, border-color 0.35s;
        }
        .bbar.out {
          opacity: 0;
          pointer-events: none;
        }
        .irow {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--irow-bg);
          border-radius: 50px;
          padding: 6px 8px 6px 12px;
          transition: background 0.35s;
        }
        .addb {
          width: 32px !important;
          height: 32px !important;
          aspect-ratio: 1;
          background: var(--wh);
          border: 1px solid var(--bd);
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          cursor: pointer;
          flex-shrink: 0 !important;
          transition: background 0.35s, border-color 0.35s, color 0.35s;
        }
        .ci {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 15px;
          color: var(--dk);
          outline: none;
          min-width: 0;
          transition: color 0.35s;
        }
        .ci::placeholder {
          color: var(--gr);
        }
        .mic,
        .snd {
          width: 34px !important;
          height: 34px !important;
          aspect-ratio: 1;
          background: var(--or);
          border-radius: 50% !important;
          border: none !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer;
          flex-shrink: 0 !important;
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
          transition: transform 0.15s, background 0.35s;
        }
        .mic:hover,
        .snd:hover {
          transform: scale(1.05);
        }
        .snd {
          display: none !important;
        }
        .snd.on {
          display: flex !important;
        }
        .chat {
          opacity: 0;
          transform: translateY(14px);
          pointer-events: none;
        }
        .chat.show {
          opacity: 1;
          pointer-events: auto;
        }
        .chat.in {
          transform: translateY(0);
        }
        .ca {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0 0 8px;
          scroll-behavior: smooth;
        }
        .ca::-webkit-scrollbar {
          width: 4px;
        }
        .ca::-webkit-scrollbar-thumb {
          background: var(--bd);
          border-radius: 4px;
        }
        .mu {
          margin: 16px 16px 0 auto;
          max-width: 80%;
          background: #007aff;
          border-radius: 20px 20px 4px 20px;
          padding: 14px 18px;
          border: none;
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(0, 122, 255, 0.3);
          animation: fu 0.3s ease;
          line-height: 1.5;
          transition: background 0.35s, color 0.35s;
        }
        .ma {
          margin: 14px 16px 0;
          animation: fu 0.3s ease;
        }
        .ahead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .albl {
          font-size: 16px;
          font-weight: 700;
          color: var(--dk);
          transition: color 0.35s;
        }
        .ares {
          background: var(--orl);
          border-radius: 14px;
          padding: 14px 18px;
          border: 1px solid var(--orm);
          font-size: 16px;
          font-weight: 600;
          color: var(--or);
          margin-bottom: 16px;
          line-height: 1.6;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
          transition: all 0.35s ease;
        }
        .sb {
          background: transparent;
          border-radius: 0;
          border: none;
          overflow: visible;
          box-shadow: none;
          padding: 4px 0 12px;
          transition: all 0.35s ease;
        }
        .sh2 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0 10px;
          margin-bottom: 6px;
          border-bottom: 1px solid var(--bd);
        }
        .slbl2 {
          font-size: 16px;
          font-weight: 700;
          color: var(--dk);
          transition: color 0.35s;
        }
        .cpb {
          font-size: 12px;
          font-weight: 500;
          color: var(--gr);
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 8px;
          transition: background 0.15s;
        }
        .cpb:hover {
          background: var(--grl);
        }
        .sdiv {
          display: none;
        }
        .sbody {
          padding: 12px 0 16px;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
          font-size: 17px;
          line-height: 1.8;
          color: var(--sbody-c);
          letter-spacing: 0.01em;
          transition: color 0.35s;
        }
        .sbody :global(p) {
          margin-bottom: 10px;
        }
        .sbody :global(p:last-child) {
          margin-bottom: 0;
        }
        .sbody :global(strong) {
          color: var(--dk);
          font-weight: 700;
        }
        .sbody :global(ol),
        .sbody :global(ul) {
          margin: 8px 0 10px;
          padding-left: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }
        .sbody :global(li) {
          padding-left: 20px;
          position: relative;
        }
        .sbody :global(li::before) {
          content: "•";
          color: var(--or);
          font-weight: 700;
          position: absolute;
          left: 0;
          top: 0;
        }
        .sbody :global(code),
        .sbody :global(pre) {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .sbody :global(code) {
          background: var(--irow-bg);
          border-radius: 6px;
          padding: 2px 5px;
          font-size: 13.5px;
        }
        .sbody :global(pre) {
          background: var(--irow-bg);
          border-radius: 10px;
          margin: 8px 0;
          padding: 12px 14px;
          overflow-x: auto;
        }
        .sbody :global(.katex-display) {
          text-align: left;
          margin: 0.6em 0;
          padding-bottom: 0.25em;
          overflow: auto hidden;
        }
        .typing {
          display: flex;
          gap: 5px;
          align-items: center;
          padding: 6px 2px;
          margin: 12px 16px 0;
        }
        .typing span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--or);
          animation: bo 0.9s infinite;
          transition: background 0.35s;
        }
        .typing span:nth-child(2) {
          animation-delay: 0.15s;
        }
        .typing span:nth-child(3) {
          animation-delay: 0.3s;
        }
        .hidden {
          display: none !important;
        }
        .swrap {
          margin: 14px 0 4px;
        }
        .swlbl {
          font-size: 11px;
          font-weight: 600;
          color: var(--gr);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 8px;
        }
        .swlist {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .chip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: var(--wh);
          border: 1px solid var(--bd);
          border-radius: 12px;
          padding: 11px 14px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: var(--dk);
          text-align: left;
          width: 100%;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
          transition: background 0.15s, border-color 0.15s, transform 0.1s,
            color 0.35s;
        }
        .chip:hover {
          background: var(--orl);
          border-color: var(--orm);
          transform: translateX(2px);
        }
        .chip:active {
          transform: scale(0.98);
        }
        .chipl {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .chipa {
          color: var(--or);
          font-size: 16px;
          transition: color 0.35s;
        }
        .chat-divider {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: var(--gr);
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin: 14px 16px 0;
        }
        .chat-divider::before,
        .chat-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--bd);
        }
        @keyframes fu {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bo {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-5px);
            opacity: 1;
          }
        }
        @media (min-width: 640px) {
          .quiz-chatbot-fab {
            bottom: 32px;
          }
          .quiz-chatbot-overlay {
            align-items: center;
            justify-content: center;
            padding: 32px;
          }
          .quiz-chatbot-modal {
            width: 100%;
            max-width: 820px;
            height: min(82vh, 680px);
            max-height: 82vh;
            border-radius: 26px !important;
            border: 1px solid var(--bd);
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
          }
          .topbar {
            padding: 16px 28px;
          }
          .ctx {
            margin: 24px 28px 0;
            padding: 16px 20px;
          }
          .ltitle {
            font-size: 26px;
            padding: 24px 28px 20px;
          }
          .opts {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            padding: 0 28px 28px;
          }
          .mu {
            margin: 22px 28px 0 auto;
            max-width: 72%;
            font-size: 17px;
          }
          .ma {
            margin: 18px 28px 0;
          }
          .sbody {
            font-size: 18px;
            line-height: 1.85;
          }
          .bbar {
            padding: 16px 28px;
          }
        }
        @media (max-width: 639px) {
          .quiz-chatbot-overlay {
            align-items: flex-end;
            padding-top: max(12px, env(safe-area-inset-top));
          }
          .quiz-chatbot-modal {
            height: min(92dvh, 760px);
            max-height: 92dvh;
            border-radius: 24px 24px 0 0;
          }
          .mobile-sheet-handle {
            display: block;
            width: 40px;
            height: 4px;
            flex: 0 0 auto;
            margin: 10px auto 0;
            border-radius: 999px;
            background: var(--bd);
          }
          .topbar {
            padding-top: 8px;
          }
          .ctx {
            margin: 12px 12px 0;
            padding: 12px;
          }
          .ltitle {
            font-size: 22px;
            padding: 20px 16px 16px;
          }
          .opts {
            gap: 8px;
            padding: 0 12px 16px;
          }
          .opt {
            padding: 12px 14px;
          }
          .oi {
            width: 38px;
            height: 38px;
            font-size: 18px;
          }
          .bbar {
            padding: 8px 12px calc(12px + env(safe-area-inset-bottom));
          }
          .ma,
          .mu {
            margin-left: 12px;
            margin-right: 12px;
          }
        }
      `}</style>
    </>
  );
}

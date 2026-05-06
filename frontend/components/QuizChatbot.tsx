"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type ChatMessage = {
  role: "bot" | "user";
  content: string;
};

export interface QuizChatbotQuestion {
  id?: number | string;
  question: string;
  options?: string[];
  correctAnswer?: number;
  answer?: string;
  solution?: string;
  concept?: string;
  exam?: string;
}

interface QuizChatbotProps {
  isVisible: boolean;
  questionNumber: number;
  topicTitle: string;
  question?: QuizChatbotQuestion;
}

function resolveCorrectAnswer(question?: QuizChatbotQuestion) {
  if (!question) return "";
  if (question.answer) return question.answer;
  if (
    typeof question.correctAnswer === "number" &&
    question.options?.[question.correctAnswer]
  ) {
    return question.options[question.correctAnswer];
  }
  return "";
}

function buildQuestionContext(
  questionNumber: number,
  topicTitle: string,
  question?: QuizChatbotQuestion
) {
  if (!question) return "";

  const options = question.options?.length
    ? question.options
        .map((option, index) => `${String.fromCharCode(65 + index)}) ${option}`)
        .join("\n")
    : "No options provided.";

  return [
    `Question ${questionNumber}`,
    `Topic: ${topicTitle}`,
    question.concept ? `Concept: ${question.concept}` : "",
    question.exam ? `Exam: ${question.exam}` : "",
    "",
    `Question:\n${question.question}`,
    "",
    `Options:\n${options}`,
    "",
    `Correct answer: ${resolveCorrectAnswer(question) || "Not provided"}`,
    question.solution ? `\nSolution:\n${question.solution}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeTutorMarkdown(content: string) {
  const latexCommand =
    /\\(?:frac|dfrac|tfrac|sin|cos|tan|cot|sec|csc|theta|times|div|sqrt|text|Rightarrow|left|right|pi|alpha|beta|gamma|cdot|le|ge|neq|approx|therefore|because|degree|overline|angle|triangle|parallel|perp|infty|sum|prod|log|ln)/;

  const cleanLatex = (value: string) =>
    value
      .replace(/\$+\s+\$+/g, " ")
      .replace(/^\$+|\$+$/g, "")
      .replace(/\$/g, "")
      .replace(/\\operatorname\{([^}]+)\}/g, "\\text{$1}")
      .replace(/\s+/g, " ")
      .trim();

  const normalizeMathLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("```")) return line;
    if (trimmed.startsWith("$$")) return line;
    if (!latexCommand.test(line)) return line;

    const listPrefixMatch = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/);
    const prefix = listPrefixMatch?.[1] ?? "";
    const body = listPrefixMatch?.[2] ?? line;
    const bodyTrimmed = body.trim();
    const proseProbe = bodyTrimmed
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/\{[^}]*\}/g, "")
      .replace(/[0-9_{}^=+\-*/().,:%\s]/g, "");

    const isRawEquation =
      bodyTrimmed.startsWith("\\") ||
      (/=/.test(bodyTrimmed) && proseProbe.length <= 2);

    if (!isRawEquation) return line;

    const math = cleanLatex(bodyTrimmed);

    return `${prefix}$$${math}$$`;
  };

  return content
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math: string) => `$${cleanLatex(math)}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => `$$${cleanLatex(math)}$$`)
    .replace(/\$+\s+\$+/g, " ")
    .replace(/\$\s*\\displaystyle\s+/g, "$")
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, math: string) => `$$${cleanLatex(math)}$$`)
    .replace(/\$([^$\n]*\\[a-zA-Z][^$\n]*)\$/g, (_, math: string) => `$${cleanLatex(math)}$`)
    .replace(
      /\*\*((?=[^*\n]*\\(?:frac|sin|cos|tan|theta))[^*\n]+)\*\*/g,
      (_, math: string) => `**$${cleanLatex(math)}$**`
    )
    .replace(
      /^\s*\[\s*((?=.*\\[a-zA-Z]+)[^\]\n]+)\s*\]\s*$/gm,
      (_, math: string) => `$$${cleanLatex(math)}$$`
    )
    .split("\n")
    .map(normalizeMathLine)
    .join("\n");
}

function stripMarkdown(value: string) {
  return value
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^#+\s*/g, "")
    .replace(/^>\s*/g, "")
    .replace(/^\s*[-*+]\s+/g, "")
    .trim();
}

function summarizeReply(content: string) {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) || "";
  const cleaned = stripMarkdown(firstLine).replace(/\s+/g, " ").trim();
  if (!cleaned) return "Here is a clear walkthrough.";
  if (cleaned.length <= 140) return cleaned;
  const sentenceEnd = cleaned.search(/[.!?]\s/);
  if (sentenceEnd > 40 && sentenceEnd < 160) {
    return cleaned.slice(0, sentenceEnd + 1);
  }
  return `${cleaned.slice(0, 137).trim()}...`;
}

export default function QuizChatbot({
  isVisible,
  questionNumber,
  topicTitle,
  question,
}: QuizChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isChatView, setIsChatView] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const response = await fetch(`${API}/api/ai/tutor-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          message: text,
        }),
      });

      const data = await response.json();
      const reply =
        data.reply ||
        data.explanation ||
        data.error ||
        "I could not generate a response. Please try again.";
      setMessages((prev) => [...prev, { role: "bot", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content:
            "I could not reach the tutor service. Check the backend connection and try again.",
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
      icon: "⚡",
    },
    {
      title: "Why is the correct option right?",
      subtitle: "Understand the logic and reasoning.",
      prompt: "Why is the correct option right?",
      tone: "o",
      icon: "✓",
    },
    {
      title: "Give me a similar practice question",
      subtitle: "Practice with a similar type of question.",
      prompt: "Give me a similar practice question",
      tone: "p",
      icon: "📄",
    },
    {
      title: "What trap should I avoid?",
      subtitle: "Learn common mistakes and how to avoid them.",
      prompt: "What trap should I avoid?",
      tone: "b",
      icon: "⚠️",
    },
    {
      title: "What is the fastest shortcut?",
      subtitle: "Get quick tricks to solve faster.",
      prompt: "What is the fastest shortcut?",
      tone: "y",
      icon: "⚡",
    },
  ];

  const followUps = [
    {
      label: "What is the fastest shortcut?",
      prompt: "What is the fastest shortcut?",
      icon: "⚡",
    },
    {
      label: "Give me a similar practice question",
      prompt: "Give me a similar practice question",
      icon: "📄",
    },
    {
      label: "What trap should I avoid?",
      prompt: "What trap should I avoid?",
      icon: "⚠️",
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
      <button
        type="button"
        className="quiz-chatbot-fab"
        onClick={() => setIsOpen(true)}
        title="Ask AI Tutor"
        aria-label="Ask AI Tutor"
      >
        AI
      </button>

      {isOpen && (
        <div
          className="quiz-chatbot-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section className="quiz-chatbot-modal" aria-label="AI Tutor chat">
            <div className={`quiz-chatbot-shell${isDark ? " dark" : ""}`}>
              <div className="topbar">
                <button type="button" className="hbtn" aria-label="Open menu">
                  <span />
                  <span />
                  <span />
                </button>
                <div className="logo">AI Tutor</div>
                <div className="top-actions">
                  <button
                    type="button"
                    className="dmbtn"
                    onClick={() => setIsDark((prev) => !prev)}
                    title="Toggle dark mode"
                    aria-label="Toggle dark mode"
                  >
                    {isDark ? "☀️" : "🌙"}
                  </button>
                  <button
                    type="button"
                    className="closebtn"
                    onClick={() => setIsOpen(false)}
                    title="Close"
                    aria-label="Close"
                  >
                    ×
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
                          <div className="ahead">
                            <span className="albl">Answer</span>
                          </div>
                          <div className="ares">{summarizeReply(message.content)}</div>
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
                                remarkPlugins={[remarkMath]}
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
                        +
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
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm-2 4v7a2 2 0 004 0V5a2 2 0 00-4 0zm-3 7a5 5 0 0010 0h2a7 7 0 01-6 6.93V21h-2v-2.07A7 7 0 015 12H7z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`snd${hasInput ? " on" : ""}`}
                        onClick={handleSend}
                        aria-label="Send message"
                        disabled={isLoading || !hasInput}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 21L23 12 2 3v7l15 2-15 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {!isChatView && (
                <div className="bbar lbar">
                  <div className="irow">
                    <button type="button" className="addb" aria-label="Attach context">
                      +
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
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm-2 4v7a2 2 0 004 0V5a2 2 0 00-4 0zm-3 7a5 5 0 0010 0h2a7 7 0 01-6 6.93V21h-2v-2.07A7 7 0 015 12H7z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`snd${hasInput ? " on" : ""}`}
                      onClick={handleSend}
                      aria-label="Send message"
                      disabled={isLoading || !hasInput}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 21L23 12 2 3v7l15 2-15 2z" />
                      </svg>
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
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          background: #f26522;
          color: #fff;
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 6px 16px rgba(242, 101, 34, 0.35);
          transition: transform 0.2s, box-shadow 0.2s;
          z-index: 500;
        }
        .quiz-chatbot-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 20px rgba(242, 101, 34, 0.45);
        }
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
          border-radius: 20px 20px 0 0;
          overflow: hidden;
          box-shadow: 0 -18px 48px rgba(15, 23, 42, 0.28);
        }
        .quiz-chatbot-shell {
          --or: #f26522;
          --orl: #fff3ee;
          --orm: #fde0ce;
          --pu: #6b5cf6;
          --pul: #f0eeff;
          --dk: #1a1a1a;
          --gr: #6b7280;
          --grl: #f5f5f5;
          --bd: #e8e8e8;
          --wh: #ffffff;
          --bg: #f7f7f7;
          --sh: 0 2px 16px rgba(0, 0, 0, 0.07);
          --sbody-c: #2d2d2d;
          --ares-bg: #fffaf7;
          --irow-bg: #f2f2f2;
          background: var(--bg);
          color: var(--dk);
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          transition: background 0.35s, color 0.35s;
        }
        .quiz-chatbot-shell.dark {
          --or: #ff7a3d;
          --orl: #2a1a0e;
          --orm: #4a2a14;
          --pu: #9b8ffa;
          --pul: #1e1a3a;
          --dk: #ececec;
          --gr: #8a929e;
          --grl: #252525;
          --bd: #2e2e2e;
          --wh: #1c1c1c;
          --bg: #111111;
          --sh: 0 2px 20px rgba(0, 0, 0, 0.5);
          --sbody-c: #cccccc;
          --ares-bg: #1f1508;
          --irow-bg: #242424;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          background: var(--wh);
          border-bottom: 1px solid var(--bd);
          flex-shrink: 0;
          transition: background 0.35s, border-color 0.35s;
        }
        .top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .closebtn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid var(--bd);
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: var(--gr);
          line-height: 1;
          transition: background 0.2s, border-color 0.35s, color 0.2s;
          flex-shrink: 0;
        }
        .closebtn:hover {
          background: var(--grl);
          color: var(--dk);
        }
        .logo {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: var(--dk);
          transition: color 0.35s;
        }
        .hbtn {
          width: 28px;
          height: 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
          background: none;
          border: 1.5px solid var(--bd);
          border-radius: 8px;
          padding: 5px 6px;
          cursor: pointer;
          transition: border-color 0.35s;
        }
        .hbtn span {
          display: block;
          height: 1.5px;
          background: var(--dk);
          border-radius: 2px;
          transition: background 0.35s;
        }
        .hbtn span:nth-child(2) {
          width: 70%;
        }
        .dmbtn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1.5px solid var(--bd);
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: background 0.2s, border-color 0.35s;
          flex-shrink: 0;
        }
        .dmbtn:hover {
          background: var(--grl);
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
          background: #e6faf0;
          color: #0f8f57;
        }
        .o {
          background: var(--orl);
          color: var(--or);
        }
        .p {
          background: var(--pul);
          color: var(--pu);
        }
        .b {
          background: #e8f4ff;
          color: #2563eb;
        }
        .y {
          background: #fffbe6;
          color: #b7791f;
        }
        .dark .g {
          background: #0d2b1a;
        }
        .dark .b {
          background: #0d1e2e;
        }
        .dark .y {
          background: #241e06;
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
          padding: 10px 14px 18px;
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
          padding: 8px 8px 8px 16px;
          transition: background 0.35s;
        }
        .addb {
          width: 36px;
          height: 36px;
          background: var(--wh);
          border: 1px solid var(--bd);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 300;
          color: var(--dk);
          cursor: pointer;
          flex-shrink: 0;
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
        .mic {
          width: 40px;
          height: 40px;
          background: var(--or);
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(242, 101, 34, 0.35);
          transition: transform 0.15s, background 0.35s;
        }
        .mic:hover {
          transform: scale(1.07);
        }
        .mic svg {
          width: 18px;
          height: 18px;
          fill: #fff;
        }
        .snd {
          width: 40px;
          height: 40px;
          background: var(--or);
          border-radius: 50%;
          border: none;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(242, 101, 34, 0.35);
          transition: background 0.35s;
        }
        .snd svg {
          width: 16px;
          height: 16px;
          fill: #fff;
        }
        .snd.on {
          display: flex;
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
          margin: 16px 16px 0;
          background: var(--wh);
          border-radius: 16px;
          padding: 14px 16px;
          border: 1px solid var(--bd);
          font-size: 14.5px;
          font-weight: 500;
          color: var(--dk);
          box-shadow: var(--sh);
          animation: fu 0.3s ease;
          transition: background 0.35s, border-color 0.35s, color 0.35s;
        }
        .ma {
          margin: 12px 16px 0;
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
          background: var(--ares-bg);
          border-radius: 12px;
          padding: 12px 16px;
          border: 1px solid var(--orm);
          font-size: 14px;
          color: var(--dk);
          margin-bottom: 12px;
          line-height: 1.7;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          transition: background 0.35s, border-color 0.35s, color 0.35s;
        }
        .sb {
          background: var(--wh);
          border-radius: 16px;
          border: 1px solid var(--bd);
          overflow: hidden;
          box-shadow: var(--sh);
          transition: background 0.35s, border-color 0.35s;
        }
        .sh2 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 0;
          margin-bottom: 8px;
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
          height: 1px;
          background: var(--bd);
          margin: 0 0 14px;
          transition: background 0.35s;
        }
        .sbody {
          padding: 0 16px 16px;
          font-size: 14.5px;
          line-height: 1.75;
          color: var(--sbody-c);
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
        }
      `}</style>
    </>
  );
}

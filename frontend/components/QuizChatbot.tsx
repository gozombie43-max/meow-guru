"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { Send, X } from "lucide-react";

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
  const hasLatexCommand = /\\(?:frac|dfrac|tfrac|sin|cos|tan|cot|sec|csc|theta|times|div|sqrt|text|Rightarrow|left|right|pi|alpha|beta|gamma|cdot|le|ge|neq|approx|therefore|because|degree)/;

  const normalizeMathLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("```")) return line;
    if (trimmed.startsWith("$$") || trimmed.startsWith("\\[")) return line;
    if (!hasLatexCommand.test(line)) return line;

    const listPrefixMatch = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/);
    const prefix = listPrefixMatch?.[1] ?? "";
    const body = listPrefixMatch?.[2] ?? line;
    const bodyTrimmed = body.trim();

    const isRawEquation =
      bodyTrimmed.startsWith("\\") ||
      (/=/.test(bodyTrimmed) && !/[a-zA-Z]{4,}/.test(bodyTrimmed.replace(/\\[a-zA-Z]+/g, "")));

    if (!isRawEquation) return line;

    const math = bodyTrimmed
      .replace(/^\$+|\$+$/g, "")
      .replace(/\$\s+\$/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return `${prefix}$$${math}$$`;
  };

  return content
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\$\s+\$/g, " ")
    .replace(
      /\*\*((?=[^*\n]*\\(?:frac|sin|cos|tan|theta))[^*\n]+)\*\*/g,
      (_, math: string) => `**$${math.trim().replace(/^\$+|\$+$/g, "")}$**`
    )
    .replace(
      /^\s*\[\s*((?=.*\\[a-zA-Z]+)[^\]\n]+)\s*\]\s*$/gm,
      (_, math: string) => `$$${math.trim().replace(/\$\s+\$/g, " ")}$$`
    )
    .split("\n")
    .map(normalizeMathLine)
    .join("\n");
}

function BotGlyph({ small = false }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={small ? "quiz-chatbot-small-glyph" : "quiz-chatbot-glyph"}
    >
      <path
        d="M12 2 L13 5 L16 6 L13 7 L12 10 L11 7 L8 6 L11 5 Z"
        fill="rgba(255,255,255,0.9)"
      />
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="4"
        fill="white"
        fillOpacity="0.95"
      />
      <path d="M8 20 L6.5 23 L10 20Z" fill="white" fillOpacity="0.95" />
      <circle cx="9" cy="15" r="1.3" fill="#5b6af0" />
      <circle cx="12" cy="15" r="1.3" fill="#7a6af5" />
      <circle cx="15" cy="15" r="1.3" fill="#9b59f5" />
    </svg>
  );
}

export default function QuizChatbot({
  isVisible,
  questionNumber,
  topicTitle,
  question,
}: QuizChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      content:
        "I have this submitted question loaded. Ask for a step-by-step explanation, the shortcut logic, or a similar practice question.",
    },
  ]);

  const context = useMemo(
    () => buildQuestionContext(questionNumber, topicTitle, question),
    [question, questionNumber, topicTitle]
  );

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

  const quickPrompts = [
    "Explain the step-by-step solution in a numbered format",
    "What is the fastest shortcut? Keep it structured",
    "Why is the correct option right? Use clear steps",
    "Give me a similar practice question with answer",
    "What trap should I avoid? Use bullets",
  ];

  return (
    <>
      <button
        type="button"
        className="quiz-chatbot-fab"
        onClick={() => setIsOpen(true)}
        title="Ask AI Tutor"
        aria-label="Ask AI Tutor"
      >
        <span className="fab-bg" />
        <span className="fab-ring" />
        <span className="fab-particle" />
        <svg
          className="fab-icon"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M14 4 L14.8 6.5 L17 7 L14.8 7.5 L14 10 L13.2 7.5 L11 7 L13.2 6.5 Z"
            fill="rgba(255,255,255,0.9)"
          />
          <rect
            x="5"
            y="11"
            width="18"
            height="12"
            rx="5"
            fill="white"
            fillOpacity="0.95"
          />
          <path d="M9 23 L7 26 L12 23Z" fill="white" fillOpacity="0.95" />
          <circle cx="10" cy="17" r="1.4" fill="#5b6af0" />
          <circle cx="14" cy="17" r="1.4" fill="#7a6af5" />
          <circle cx="18" cy="17" r="1.4" fill="#9b59f5" />
        </svg>
        <span className="fab-dot" />
      </button>

      {isOpen && (
        <div
          className="quiz-chatbot-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section className="quiz-chatbot-modal" aria-label="AI Tutor chat">
            <header className="modal-header">
              <div className="bot-avatar-wrap">
                <div className="bot-avatar">
                  <BotGlyph />
                </div>
                <div className="avatar-ring" />
                <div className="online-dot" />
              </div>
              <div className="modal-title">
                <h3>AI Tutor</h3>
                <p>Explain · Solve · Clarify · Online now</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close AI Tutor"
              >
                <X size={17} />
              </button>
            </header>

            <div className="context-pill">
              <span className="context-pill-icon">Q</span>
              <div>
                <strong>Context loaded:</strong> Q{questionNumber} ·{" "}
                {question.concept || topicTitle}
                {question.exam ? ` · ${question.exam}` : ""}
                <br />
                <span>Ask anything about this submitted question.</span>
              </div>
            </div>

            <div className="quick-prompts">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="qp-btn"
                  onClick={() => sendMessage(prompt)}
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="messages">
              <div className="chat-divider">Start of conversation</div>
              {messages.map((message, index) => (
                <div className={`msg ${message.role}`} key={`${message.role}-${index}`}>
                  <div className="msg-avatar">
                    {message.role === "bot" ? <BotGlyph small /> : "You"}
                  </div>
                  <div className="msg-bubble">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {normalizeTutorMarkdown(message.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="msg bot">
                  <div className="msg-avatar">
                    <BotGlyph small />
                  </div>
                  <div className="msg-bubble">
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form
              className="input-bar"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about this question..."
                rows={1}
                disabled={isLoading}
              />
              <button type="submit" className="send-btn" disabled={isLoading || !input.trim()}>
                <Send size={18} fill="white" />
              </button>
            </form>
          </section>
        </div>
      )}

      <style jsx>{`
        .quiz-chatbot-fab {
          position: fixed;
          bottom: 92px;
          right: 24px;
          width: 62px;
          height: 62px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 500;
          animation: fabBounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          background: transparent;
        }
        .quiz-chatbot-fab:hover {
          transform: scale(1.1) rotate(5deg);
        }
        .fab-bg {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: linear-gradient(135deg, #5b6af0, #9b59f5);
          box-shadow: 0 8px 32px rgba(91, 106, 240, 0.55);
          animation: fabPulse 2.5s ease-in-out infinite;
        }
        .fab-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid transparent;
          background: conic-gradient(
              from 0deg,
              transparent 60%,
              rgba(91, 106, 240, 0.9) 80%,
              rgba(155, 89, 245, 0.9) 100%
            )
            border-box;
          -webkit-mask: linear-gradient(#fff 0 0) padding-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          animation: ringRotate 3s linear infinite;
        }
        .fab-particle {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fff;
          top: 50%;
          left: 50%;
          margin: -4px 0 0 -4px;
          animation: orbitParticle 3s linear infinite;
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
        }
        .fab-icon {
          position: relative;
          z-index: 2;
          width: 28px;
          height: 28px;
        }
        .fab-dot {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #22d98e;
          border: 2.5px solid #080b14;
          z-index: 3;
          animation: dotPop 0.4s 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .quiz-chatbot-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          z-index: 600;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .quiz-chatbot-modal {
          width: 100%;
          max-width: 540px;
          height: 85vh;
          background: #0e1422;
          border-radius: 28px 28px 0 0;
          border-top: 1px solid #2d3c57;
          border-left: 1px solid #243048;
          border-right: 1px solid #243048;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.38s cubic-bezier(0.34, 1.2, 0.64, 1) both;
          position: relative;
        }
        .quiz-chatbot-modal::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(135deg, #5b6af0, #9b59f5);
        }
        .modal-header {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 18px 20px 15px;
          border-bottom: 1px solid #243048;
          flex-shrink: 0;
          background: rgba(17, 24, 39, 0.8);
        }
        .bot-avatar-wrap {
          position: relative;
          width: 44px;
          height: 44px;
          flex-shrink: 0;
        }
        .bot-avatar {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, #5b6af0, #9b59f5);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(91, 106, 240, 0.4);
        }
        .bot-avatar::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.15) 0%,
            transparent 60%
          );
          border-radius: 14px;
        }
        .avatar-ring {
          position: absolute;
          inset: -3px;
          border-radius: 17px;
          border: 2px solid transparent;
          background: conic-gradient(from 0deg, #5b6af0, #9b59f5, #5b6af0)
            border-box;
          -webkit-mask: linear-gradient(#fff 0 0) padding-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          animation: ringRotate 4s linear infinite;
          opacity: 0.7;
        }
        .online-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #22d98e;
          border: 2.5px solid #0e1422;
          z-index: 2;
          animation: dotPulse 2s ease-in-out infinite;
        }
        .quiz-chatbot-glyph {
          width: 24px;
          height: 24px;
          position: relative;
          z-index: 1;
        }
        .quiz-chatbot-small-glyph {
          width: 16px;
          height: 16px;
        }
        .modal-title {
          flex: 1;
          min-width: 0;
        }
        .modal-title h3 {
          font-size: 15px;
          font-weight: 800;
          background: linear-gradient(135deg, #5b6af0, #9b59f5);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .modal-title p {
          font-size: 11px;
          color: #5c6b8a;
          margin-top: 1px;
          font-weight: 500;
        }
        .close-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid #2d3c57;
          background: #1a2236;
          color: #9ba8c8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .close-btn:hover {
          background: #1f2a40;
          color: #e2e8f8;
        }
        .context-pill {
          margin: 12px 16px 0;
          padding: 10px 14px;
          background: rgba(91, 106, 240, 0.07);
          border: 1px solid rgba(91, 106, 240, 0.2);
          border-radius: 12px;
          font-size: 12px;
          color: #9ba8c8;
          line-height: 1.55;
          flex-shrink: 0;
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .context-pill-icon {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          background: linear-gradient(135deg, #5b6af0, #9b59f5);
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .context-pill strong {
          color: #5b6af0;
          font-weight: 700;
        }
        .context-pill span:last-child {
          color: #9ba8c8;
          font-size: 11px;
        }
        .quick-prompts {
          display: flex;
          gap: 7px;
          padding: 10px 16px;
          overflow-x: auto;
          flex-shrink: 0;
          scrollbar-width: none;
        }
        .quick-prompts::-webkit-scrollbar {
          display: none;
        }
        .qp-btn {
          flex-shrink: 0;
          padding: 7px 13px;
          border-radius: 20px;
          border: 1px solid #2d3c57;
          background: #1a2236;
          color: #9ba8c8;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .qp-btn:hover:not(:disabled) {
          border-color: rgba(91, 106, 240, 0.5);
          color: #5b6af0;
          background: rgba(91, 106, 240, 0.08);
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          scrollbar-width: thin;
          scrollbar-color: #243048 transparent;
        }
        .msg {
          display: flex;
          gap: 10px;
          animation: msgIn 0.28s cubic-bezier(0.34, 1.4, 0.64, 1) both;
        }
        .msg.user {
          flex-direction: row-reverse;
        }
        .msg-avatar {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
        }
        .msg.bot .msg-avatar {
          background: linear-gradient(135deg, #5b6af0, #9b59f5);
          box-shadow: 0 2px 8px rgba(91, 106, 240, 0.3);
        }
        .msg.user .msg-avatar {
          background: #1f2a40;
          border: 1px solid #2d3c57;
          color: #9ba8c8;
        }
        .msg-bubble {
          max-width: 84%;
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 13.5px;
          line-height: 1.62;
        }
        .msg.bot .msg-bubble {
          background: #1a2236;
          border: 1px solid #2d3c57;
          border-bottom-left-radius: 5px;
          color: #e2e8f8;
        }
        .msg.user .msg-bubble {
          background: linear-gradient(135deg, #5b6af0, #9b59f5);
          border-bottom-right-radius: 5px;
          color: #fff;
          box-shadow: 0 4px 16px rgba(91, 106, 240, 0.3);
        }
        .msg-bubble :global(p) {
          margin: 0 0 10px;
        }
        .msg-bubble :global(p:last-child) {
          margin-bottom: 0;
        }
        .msg-bubble :global(h1),
        .msg-bubble :global(h2),
        .msg-bubble :global(h3) {
          margin: 0 0 10px;
          color: #c4b5fd;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
        }
        .msg-bubble :global(strong) {
          color: #a5b4fc;
          font-weight: 700;
        }
        .msg-bubble :global(ol),
        .msg-bubble :global(ul) {
          margin: 8px 0 10px;
          padding-left: 0;
          display: grid;
          gap: 8px;
          list-style: none;
        }
        .msg-bubble :global(ol) {
          counter-reset: tutor-step;
        }
        .msg-bubble :global(li) {
          position: relative;
          padding-left: 30px;
          color: #e2e8f8;
        }
        .msg-bubble :global(ol > li) {
          counter-increment: tutor-step;
        }
        .msg-bubble :global(ol > li::before) {
          content: counter(tutor-step);
          position: absolute;
          left: 0;
          top: 1px;
          width: 20px;
          height: 20px;
          border-radius: 7px;
          background: rgba(91, 106, 240, 0.22);
          border: 1px solid rgba(91, 106, 240, 0.45);
          color: #c4b5fd;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
        }
        .msg-bubble :global(ul > li::before) {
          content: "";
          position: absolute;
          left: 6px;
          top: 10px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22d98e;
          box-shadow: 0 0 0 3px rgba(34, 217, 142, 0.12);
        }
        .msg-bubble :global(code) {
          background: rgba(91, 106, 240, 0.15);
          padding: 2px 6px;
          border-radius: 5px;
          font-size: 12px;
          color: #86efac;
        }
        .msg-bubble :global(pre) {
          margin: 8px 0 10px;
          padding: 10px 12px;
          overflow-x: auto;
          border-radius: 12px;
          background: rgba(8, 11, 20, 0.55);
          border: 1px solid #2d3c57;
        }
        .msg-bubble :global(pre code) {
          padding: 0;
          background: transparent;
          color: #dbeafe;
        }
        .msg-bubble :global(blockquote) {
          margin: 10px 0;
          padding: 9px 12px;
          border-left: 3px solid #22d98e;
          border-radius: 0 10px 10px 0;
          background: rgba(34, 217, 142, 0.07);
          color: #dbeafe;
        }
        .msg-bubble :global(hr) {
          margin: 12px 0;
          border: 0;
          border-top: 1px solid #2d3c57;
        }
        .typing-dots {
          display: flex;
          gap: 5px;
          align-items: center;
          padding: 4px 2px;
        }
        .typing-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #5c6b8a;
          animation: typeDot 1.3s ease-in-out infinite;
        }
        .typing-dots span:nth-child(2) {
          animation-delay: 0.15s;
        }
        .typing-dots span:nth-child(3) {
          animation-delay: 0.3s;
        }
        .input-bar {
          display: flex;
          gap: 10px;
          padding: 12px 16px 22px;
          border-top: 1px solid #243048;
          flex-shrink: 0;
          background: #0e1422;
          align-items: flex-end;
        }
        .input-bar textarea {
          flex: 1;
          background: #1a2236;
          border: 1.5px solid #2d3c57;
          border-radius: 14px;
          padding: 11px 14px;
          color: #e2e8f8;
          font-size: 13.5px;
          outline: none;
          resize: none;
          height: 46px;
          max-height: 110px;
          transition: border-color 0.2s, box-shadow 0.2s;
          line-height: 1.5;
        }
        .input-bar textarea:focus {
          border-color: rgba(91, 106, 240, 0.6);
          box-shadow: 0 0 0 3px rgba(91, 106, 240, 0.1);
        }
        .input-bar textarea::placeholder {
          color: #5c6b8a;
        }
        .send-btn {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: linear-gradient(135deg, #5b6af0, #9b59f5);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.22s;
          flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(91, 106, 240, 0.35);
        }
        .send-btn:hover:not(:disabled) {
          transform: scale(1.06);
          box-shadow: 0 6px 22px rgba(91, 106, 240, 0.5);
        }
        .send-btn:disabled,
        .qp-btn:disabled,
        .input-bar textarea:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .chat-divider {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: #5c6b8a;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .chat-divider::before,
        .chat-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #243048;
        }
        @keyframes fabBounceIn {
          0% {
            transform: scale(0) rotate(-45deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes fabPulse {
          0%,
          100% {
            box-shadow: 0 8px 32px rgba(91, 106, 240, 0.55),
              0 0 0 0 rgba(91, 106, 240, 0.3);
          }
          50% {
            box-shadow: 0 8px 40px rgba(91, 106, 240, 0.7),
              0 0 0 10px rgba(91, 106, 240, 0);
          }
        }
        @keyframes ringRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes orbitParticle {
          0% {
            transform: rotate(0deg) translateX(34px) rotate(0deg);
            opacity: 1;
          }
          48% {
            opacity: 1;
          }
          50% {
            opacity: 0;
            transform: rotate(180deg) translateX(34px) rotate(-180deg);
          }
          52% {
            opacity: 1;
          }
          100% {
            transform: rotate(360deg) translateX(34px) rotate(-360deg);
            opacity: 1;
          }
        }
        @keyframes dotPop {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }
        @keyframes dotPulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(34, 217, 142, 0.4);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(34, 217, 142, 0);
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes msgIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes typeDot {
          0%,
          60%,
          100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          30% {
            transform: translateY(-6px);
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

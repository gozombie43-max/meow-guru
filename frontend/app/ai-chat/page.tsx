'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import {
  BookOpen,
  Brain,
  ChevronRight,
  Copy,
  Edit3,
  Menu,
  Mic,
  PanelLeft,
  Plus,
  Search,
  SendHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import api from '@/lib/axios';

const API = process.env.NEXT_PUBLIC_API_URL || '';

type ChatMessage = {
  role: 'bot' | 'user';
  content: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

const ASSISTANT_CONTEXT = `You are a friendly AI study partner for SSC CGL and CHSL aspirants.
Help with concept clarification, step-by-step solutions, shortcuts, practice questions, and revision notes.
Keep answers concise, structured, and easy to scan.
Use markdown for formatting and LaTeX math with $...$ or $$...$$ when needed.`;

function createChatId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getChatTitle(message: string) {
  const cleaned = stripMarkdown(message).replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New chat';
  return cleaned.length > 48 ? `${cleaned.slice(0, 45).trim()}...` : cleaned;
}

function normalizeTutorMarkdown(content: string) {
  const latexCommand =
    /\\(?:frac|dfrac|tfrac|sin|cos|tan|cot|sec|csc|theta|times|div|sqrt|text|Rightarrow|left|right|pi|alpha|beta|gamma|cdot|le|ge|neq|approx|therefore|because|degree|overline|angle|triangle|parallel|perp|infty|sum|prod|log|ln)/;

  const cleanLatex = (value: string) =>
    value
      .replace(/\$+\s+\$+/g, ' ')
      .replace(/^\$+|\$+$/g, '')
      .replace(/\$/g, '')
      .replace(/\\operatorname\{([^}]+)\}/g, '\\text{$1}')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizeMathLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```')) return line;
    if (trimmed.startsWith('$$')) return line;
    if (!latexCommand.test(line)) return line;

    const listPrefixMatch = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/);
    const prefix = listPrefixMatch?.[1] ?? '';
    const body = listPrefixMatch?.[2] ?? line;
    const bodyTrimmed = body.trim();
    const proseProbe = bodyTrimmed
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/[0-9_{}^=+\-*/().,:%\s]/g, '');

    const isRawEquation =
      bodyTrimmed.startsWith('\\') ||
      (/=/.test(bodyTrimmed) && proseProbe.length <= 2);

    if (!isRawEquation) return line;

    const math = cleanLatex(bodyTrimmed);
    return `${prefix}$$${math}$$`;
  };

  return content
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math: string) => `$${cleanLatex(math)}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => `$$${cleanLatex(math)}$$`)
    .replace(/\$+\s+\$+/g, ' ')
    .replace(/\$\s*\\displaystyle\s+/g, '$')
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
    .split('\n')
    .map(normalizeMathLine)
    .join('\n');
}

function stripMarkdown(value: string) {
  return value
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^#+\s*/g, '')
    .replace(/^>\s*/g, '')
    .replace(/^\s*[-*+]\s+/g, '')
    .trim();
}

function summarizeReply(content: string) {
  const firstLine =
    content
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) || '';
  const cleaned = stripMarkdown(firstLine).replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Here is a clear walkthrough.';
  if (cleaned.length <= 140) return cleaned;
  const sentenceEnd = cleaned.search(/[.!?]\s/);
  if (sentenceEnd > 40 && sentenceEnd < 160) {
    return cleaned.slice(0, sentenceEnd + 1);
  }
  return `${cleaned.slice(0, 137).trim()}...`;
}

function AiChatPageContent() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => ASSISTANT_CONTEXT, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setSidebarOpen(false);
    }

    let cancelled = false;

    const loadBackendChats = async () => {
      try {
        const { data } = await api.get('/users/me/ai-chats');
        if (cancelled) return;

        const backendChats = Array.isArray(data.aiChats) ? (data.aiChats as ChatSession[]) : [];
        setChatSessions(backendChats);
        if (backendChats[0]) {
          setActiveChatId(backendChats[0].id);
          setMessages(backendChats[0].messages);
        }
      } catch (err) {
        console.warn('Could not load AI chat history', err);
      }
    };

    loadBackendChats();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isLoading]);

  const persistSession = async (session: ChatSession) => {
    try {
      await api.put(`/users/me/ai-chats/${encodeURIComponent(session.id)}`, {
        title: session.title,
        messages: session.messages,
      });
    } catch (err) {
      console.warn('Could not save AI chat history', err);
    }
  };

  const saveSessionMessages = (chatId: string, nextMessages: ChatMessage[], firstUserMessage: string) => {
    let sessionToPersist: ChatSession | null = null;

    setChatSessions((prev) => {
      const existing = prev.find((session) => session.id === chatId);
      const nextSession: ChatSession = {
        id: chatId,
        title: existing?.title || getChatTitle(firstUserMessage),
        messages: nextMessages,
        updatedAt: new Date().toISOString(),
      };
      const nextSessions = [nextSession, ...prev.filter((session) => session.id !== chatId)].slice(0, 30);
      sessionToPersist = nextSession;
      return nextSessions;
    });

    queueMicrotask(() => {
      if (sessionToPersist) void persistSession(sessionToPersist);
    });
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setCopiedIndex(null);
  };

  const openChat = (session: ChatSession) => {
    setActiveChatId(session.id);
    setMessages(session.messages);
    setInput('');
    setCopiedIndex(null);
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setSidebarOpen(false);
    }
  };

  async function sendMessage(nextText?: string) {
    const text = (nextText ?? input).trim();
    if (!text || isLoading) return;

    const chatId = activeChatId || createChatId();
    const previousMessages = activeChatId ? messages : [];
    const userMessages = [...previousMessages, { role: 'user' as const, content: text }];

    if (!activeChatId) setActiveChatId(chatId);
    setInput('');
    setMessages(userMessages);
    saveSessionMessages(chatId, userMessages, text);
    setIsLoading(true);

    try {
      const response = await fetch(`${API}/api/ai/tutor-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          message: text,
          history: previousMessages.slice(-16),
        }),
      });

      const data = await response.json();
      const reply =
        data.reply || data.explanation || data.error || 'I could not generate a response. Please try again.';
      const nextMessages = [...userMessages, { role: 'bot' as const, content: reply }];
      setMessages(nextMessages);
      saveSessionMessages(chatId, nextMessages, text);
    } catch {
      const nextMessages = [
        ...userMessages,
        {
          role: 'bot' as const,
          content: 'I could not reach the tutor service. Check the backend connection and try again.',
        },
      ];
      setMessages(nextMessages);
      saveSessionMessages(chatId, nextMessages, text);
    } finally {
      setIsLoading(false);
    }
  }

  const promptCards = [
    {
      title: 'Explain a concept',
      text: 'Explain profit and loss shortcuts for SSC CGL with examples.',
      icon: BookOpen,
    },
    {
      title: 'Solve a question',
      text: 'Solve this step by step and show the fastest method.',
      icon: Brain,
    },
    {
      title: 'Make practice',
      text: 'Create 5 mixed SSC questions from percentage and ratio.',
      icon: Edit3,
    },
    {
      title: 'Find traps',
      text: 'What common traps should I avoid in time and work questions?',
      icon: Sparkles,
    },
  ];

  const starterPrompts = [
    'Mensuration formula revision',
    'Percentage shortcut method',
    'Current affairs quick quiz',
    'Cloze test strategy',
  ];

  const hasInput = input.trim().length > 0;
  const hasMessages = messages.length > 0;
  const visibleSessions = chatSessions.filter((session) =>
    session.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const handleSend = () => {
    if (!hasInput || isLoading) return;
    sendMessage();
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1800);
    } catch {
      setCopiedIndex(null);
    }
  };

  const handleClear = () => {
    if (!activeChatId) {
      startNewChat();
      return;
    }

    setChatSessions((prev) => {
      const nextSessions = prev.filter((session) => session.id !== activeChatId);
      return nextSessions;
    });
    void api.delete(`/users/me/ai-chats/${encodeURIComponent(activeChatId)}`).catch((err) => {
      console.warn('Could not delete AI chat history', err);
    });
    startNewChat();
  };

  return (
    <main className={`ai-chat-page${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <aside className={`ai-sidebar${sidebarOpen ? '' : ' is-collapsed'}`} aria-label="AI chat sidebar">
        <div className="sidebar-head">
          <button className="icon-btn" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle sidebar">
            <PanelLeft size={18} />
          </button>
          <button className="new-chat" type="button" onClick={startNewChat}>
            <Plus size={17} />
            <span>New chat</span>
          </button>
        </div>

        <div className="sidebar-search">
          <Search size={16} />
          <input
            placeholder="Search chats"
            aria-label="Search chats"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="sidebar-section">
          <div className="section-label">{visibleSessions.length > 0 ? 'Saved chats' : 'Start with'}</div>
          {visibleSessions.length > 0
            ? visibleSessions.map((session) => (
                <button
                  className={`history-item${session.id === activeChatId ? ' is-active' : ''}`}
                  type="button"
                  key={session.id}
                  onClick={() => openChat(session)}
                  title={session.title}
                >
                  <span>{session.title}</span>
                </button>
              ))
            : starterPrompts.map((prompt) => (
                <button className="history-item" type="button" key={prompt} onClick={() => sendMessage(prompt)}>
                  <span>{prompt}</span>
                </button>
              ))}
        </div>

        <div className="sidebar-footer">
          <div className="mini-avatar">AI</div>
          <div>
            <strong>SSC Tutor</strong>
            <span>Desktop mode</span>
          </div>
        </div>
      </aside>

      <section className="chat-workspace" aria-label="AI Tutor chat">
        <header className="chat-topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-btn" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-label="Open sidebar">
              <Menu size={19} />
            </button>
            <div>
              <div className="chat-title">AI Tutor</div>
              <div className="chat-status">
                <span />
                SSC CGL and CHSL study assistant
              </div>
            </div>
          </div>
          <button className="clear-btn" type="button" onClick={handleClear} disabled={!hasMessages && !input}>
            <Trash2 size={16} />
            Clear
          </button>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          {!hasMessages ? (
            <section className="welcome-panel">
              <div className="assistant-mark">
                <Sparkles size={26} />
              </div>
              <h1>How can I help you study today?</h1>
              <p>Ask for shortcuts, explanations, practice questions, revision notes, or paste a question for a clean solution.</p>
              <div className="prompt-grid">
                {promptCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button className="prompt-card" type="button" key={card.title} onClick={() => sendMessage(card.text)}>
                      <span className="prompt-icon">
                        <Icon size={18} />
                      </span>
                      <strong>{card.title}</strong>
                      <span>{card.text}</span>
                      <ChevronRight size={16} className="prompt-arrow" />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="message-list">
              {messages.map((message, index) => {
                if (message.role === 'user') {
                  return (
                    <article className="message-row user-row" key={`${message.role}-${index}`}>
                      <div className="message-bubble user-bubble">{message.content}</div>
                    </article>
                  );
                }

                return (
                  <article className="message-row assistant-row" key={`${message.role}-${index}`}>
                    <div className="assistant-avatar">AI</div>
                    <div className="assistant-message">
                      <div className="answer-summary">{summarizeReply(message.content)}</div>
                      <div className="answer-card">
                        <div className="answer-head">
                          <span>Solution</span>
                          <button type="button" onClick={() => handleCopy(message.content, index)}>
                            <Copy size={15} />
                            {copiedIndex === index ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="answer-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false }]]}
                          >
                            {normalizeTutorMarkdown(message.content)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {isLoading && (
                <article className="message-row assistant-row">
                  <div className="assistant-avatar">AI</div>
                  <div className="typing-card" aria-label="AI Tutor is typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              )}
            </div>
          )}
        </div>

        <form
          className="composer-wrap"
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
        >
          <div className="composer">
            <button className="composer-tool" type="button" aria-label="Add context">
              <Plus size={20} />
            </button>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message AI Tutor"
              rows={1}
              disabled={isLoading}
            />
            <button className="composer-tool mic-btn" type="button" aria-label="Voice input">
              <Mic size={19} />
            </button>
            <button className="send-btn" type="submit" disabled={!hasInput || isLoading} aria-label="Send message">
              <SendHorizontal size={20} />
            </button>
          </div>
          <div className="composer-note">AI Tutor can make mistakes. Verify important exam facts and calculations.</div>
        </form>
      </section>

      <style jsx>{`
        .ai-chat-page {
          --surface: #ffffff;
          --surface-soft: #f7f7f8;
          --surface-muted: #ececf1;
          --ink: #171717;
          --muted: #6b7280;
          --line: #e5e7eb;
          --accent: #10a37f;
          --accent-dark: #0b7f63;
          min-height: 100dvh;
          display: grid;
          grid-template-columns: 288px minmax(0, 1fr);
          background: #ffffff;
          color: var(--ink);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .ai-chat-page.sidebar-collapsed {
          grid-template-columns: 76px minmax(0, 1fr);
        }

        .ai-sidebar {
          background: #f4f4f5;
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          min-width: 0;
          transition: width 180ms ease, transform 180ms ease;
        }

        .ai-sidebar.is-collapsed {
          width: 76px;
        }

        .ai-sidebar.is-collapsed .new-chat span,
        .ai-sidebar.is-collapsed .sidebar-search,
        .ai-sidebar.is-collapsed .sidebar-section,
        .ai-sidebar.is-collapsed .sidebar-footer div {
          display: none;
        }

        .sidebar-head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px;
        }

        .icon-btn,
        .composer-tool,
        .send-btn,
        .clear-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          cursor: pointer;
        }

        .icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: transparent;
          color: #404040;
        }

        .icon-btn:hover,
        .history-item:hover,
        .new-chat:hover {
          background: #e8e8eb;
        }

        .new-chat {
          height: 38px;
          flex: 1;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #202123;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          padding: 0 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .sidebar-search {
          margin: 2px 14px 12px;
          height: 38px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #ffffff;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          color: var(--muted);
        }

        .sidebar-search input {
          border: 0;
          background: transparent;
          outline: none;
          width: 100%;
          min-width: 0;
          font-size: 13px;
          color: var(--ink);
        }

        .sidebar-section {
          padding: 8px 10px;
          overflow-y: auto;
          flex: 1;
        }

        .section-label {
          padding: 8px 8px 6px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        .history-item {
          width: 100%;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #2f2f2f;
          display: block;
          padding: 10px 9px;
          text-align: left;
          font-size: 13px;
          cursor: pointer;
        }

        .history-item span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .history-item.is-active {
          background: #e8e8eb;
          font-weight: 600;
        }

        .sidebar-footer {
          border-top: 1px solid var(--line);
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #202123;
        }

        .mini-avatar,
        .assistant-avatar,
        .assistant-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .mini-avatar,
        .assistant-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          font-size: 12px;
          font-weight: 800;
        }

        .sidebar-footer strong,
        .sidebar-footer span {
          display: block;
          font-size: 13px;
          line-height: 1.3;
        }

        .sidebar-footer span {
          color: var(--muted);
          font-size: 12px;
        }

        .chat-workspace {
          min-width: 0;
          min-height: 100dvh;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          background: var(--surface);
        }

        .chat-topbar {
          height: 58px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 22px;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(16px);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .mobile-menu {
          display: none;
        }

        .chat-title {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.2;
        }

        .chat-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--muted);
          font-size: 12px;
        }

        .chat-status span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
        }

        .clear-btn {
          gap: 7px;
          height: 36px;
          padding: 0 12px;
          border-radius: 8px;
          background: var(--surface-soft);
          color: #3f3f46;
          font-size: 13px;
          font-weight: 600;
        }

        .clear-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .chat-scroll {
          min-height: 0;
          overflow-y: auto;
          scroll-behavior: smooth;
        }

        .welcome-panel {
          min-height: 100%;
          width: min(860px, calc(100% - 48px));
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 0 34px;
        }

        .assistant-mark {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: #111827;
          color: white;
          margin: 0 auto 20px;
        }

        .welcome-panel h1 {
          text-align: center;
          font-size: clamp(30px, 4vw, 46px);
          line-height: 1.08;
          font-weight: 750;
          letter-spacing: 0;
          color: #202123;
          margin: 0;
        }

        .welcome-panel p {
          width: min(620px, 100%);
          text-align: center;
          margin: 14px auto 30px;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.6;
        }

        .prompt-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .prompt-card {
          position: relative;
          min-height: 124px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #ffffff;
          padding: 16px 44px 16px 16px;
          text-align: left;
          color: var(--ink);
          cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
        }

        .prompt-card:hover {
          border-color: #c9cbd1;
          background: #fafafa;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
        }

        .prompt-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #effaf6;
          color: var(--accent-dark);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .prompt-card strong,
        .prompt-card span {
          display: block;
        }

        .prompt-card strong {
          font-size: 14px;
          margin-bottom: 5px;
        }

        .prompt-card span:not(.prompt-icon) {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .prompt-arrow {
          position: absolute;
          right: 16px;
          top: 18px;
          color: #9ca3af;
        }

        .message-list {
          width: min(900px, calc(100% - 40px));
          margin: 0 auto;
          padding: 28px 0 34px;
        }

        .message-row {
          display: flex;
          gap: 14px;
          margin-bottom: 26px;
        }

        .user-row {
          justify-content: flex-end;
        }

        .message-bubble {
          max-width: min(70%, 720px);
          border-radius: 18px;
          padding: 12px 15px;
          font-size: 15px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .user-bubble {
          background: #f4f4f4;
          color: #171717;
          border-bottom-right-radius: 6px;
        }

        .assistant-message {
          flex: 1;
          min-width: 0;
        }

        .answer-summary {
          display: inline-block;
          max-width: 100%;
          margin-bottom: 10px;
          border-radius: 8px;
          background: #f7f7f8;
          padding: 10px 12px;
          color: #2f2f2f;
          font-size: 14px;
          line-height: 1.55;
        }

        .answer-card {
          border: 1px solid var(--line);
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
        }

        .answer-head {
          height: 44px;
          padding: 0 14px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fafafa;
          color: #202123;
          font-size: 13px;
          font-weight: 700;
        }

        .answer-head button {
          border: 0;
          background: transparent;
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .answer-body {
          padding: 16px 18px 18px;
          color: #242424;
          font-size: 15px;
          line-height: 1.75;
        }

        .answer-body :global(p) {
          margin: 0 0 12px;
        }

        .answer-body :global(p:last-child) {
          margin-bottom: 0;
        }

        .answer-body :global(ol),
        .answer-body :global(ul) {
          padding-left: 22px;
          margin: 10px 0 12px;
        }

        .answer-body :global(li) {
          margin-bottom: 6px;
        }

        .answer-body :global(code) {
          background: #f2f2f2;
          border-radius: 5px;
          padding: 2px 5px;
          font-size: 13px;
        }

        .answer-body :global(pre) {
          overflow-x: auto;
          background: #f2f2f2;
          border-radius: 8px;
          padding: 12px 14px;
          margin: 10px 0;
        }

        .answer-body :global(.katex-display) {
          overflow: auto hidden;
          text-align: left;
          margin: 0.75em 0;
          padding-bottom: 0.2em;
        }

        .typing-card {
          height: 42px;
          min-width: 72px;
          border-radius: 8px;
          background: #f7f7f8;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 14px;
        }

        .typing-card span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
          animation: typingBounce 900ms infinite ease-in-out;
        }

        .typing-card span:nth-child(2) {
          animation-delay: 130ms;
        }

        .typing-card span:nth-child(3) {
          animation-delay: 260ms;
        }

        .composer-wrap {
          width: min(900px, calc(100% - 40px));
          margin: 0 auto;
          padding: 14px 0 18px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0), #ffffff 22%);
        }

        .composer {
          min-height: 58px;
          border: 1px solid #d9d9e3;
          border-radius: 14px;
          background: #ffffff;
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 9px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
        }

        .composer textarea {
          flex: 1;
          min-width: 0;
          max-height: 160px;
          resize: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: #171717;
          padding: 10px 4px 8px;
          font: inherit;
          font-size: 15px;
          line-height: 1.5;
        }

        .composer textarea::placeholder {
          color: #8a8f98;
        }

        .composer-tool {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: transparent;
          color: #52525b;
          flex: 0 0 auto;
        }

        .composer-tool:hover {
          background: #f2f2f2;
        }

        .send-btn {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          flex: 0 0 auto;
        }

        .send-btn:hover:not(:disabled) {
          background: var(--accent-dark);
        }

        .send-btn:disabled {
          background: #d4d4d8;
          cursor: not-allowed;
        }

        .composer-note {
          margin-top: 8px;
          text-align: center;
          color: var(--muted);
          font-size: 12px;
        }

        @keyframes typingBounce {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.45;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        @media (max-width: 900px) {
          .ai-chat-page {
            grid-template-columns: 1fr;
            width: 100%;
            min-height: 100svh;
            overflow-x: hidden;
          }

          .ai-chat-page.sidebar-collapsed {
            grid-template-columns: 1fr;
          }

          .ai-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            width: min(82vw, 320px);
            z-index: 40;
            transform: translateX(-100%);
            box-shadow: 18px 0 44px rgba(15, 23, 42, 0.18);
          }

          .ai-sidebar:not(.is-collapsed) {
            transform: translateX(0);
          }

          .ai-sidebar.is-collapsed {
            transform: translateX(-100%);
            width: min(82vw, 320px);
          }

          .mobile-menu {
            display: inline-flex;
          }

          .chat-topbar {
            height: auto;
            min-height: 62px;
            padding: 8px 12px;
            align-items: center;
            gap: 10px;
          }

          .topbar-left {
            flex: 1 1 auto;
            min-width: 0;
            gap: 10px;
          }

          .topbar-left > div {
            min-width: 0;
          }

          .chat-title,
          .chat-status {
            min-width: 0;
          }

          .chat-status {
            line-height: 1.35;
          }

          .clear-btn {
            flex: 0 0 auto;
            padding: 0 10px;
          }

          .prompt-grid {
            grid-template-columns: 1fr;
          }

          .welcome-panel {
            width: min(100% - 28px, 720px);
            justify-content: flex-start;
            padding-top: 42px;
          }

          .message-list,
          .composer-wrap {
            width: calc(100% - 24px);
          }

          .message-bubble {
            max-width: 88%;
          }

          .composer-wrap {
            padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
          }

          .mic-btn {
            display: none;
          }
        }

        @media (max-width: 420px) {
          .chat-topbar {
            padding-inline: 8px;
          }

          .icon-btn {
            width: 36px;
            height: 36px;
          }

          .chat-title {
            font-size: 15px;
          }

          .chat-status {
            font-size: 11px;
          }

          .clear-btn {
            width: 38px;
            padding: 0;
          }

          .clear-btn svg {
            width: 17px;
            height: 17px;
          }

          .clear-btn {
            font-size: 0;
            gap: 0;
          }

          .message-list,
          .composer-wrap,
          .welcome-panel {
            width: calc(100% - 16px);
          }

          .message-bubble {
            max-width: 86%;
            font-size: 14px;
            padding: 10px 13px;
          }

          .assistant-avatar {
            display: none;
          }

          .message-row {
            gap: 8px;
          }

          .composer {
            min-height: 54px;
            gap: 6px;
            padding: 8px;
          }

          .composer-tool,
          .send-btn {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </main>
  );
}

export default function AiChatPage() {
  return (
    <ProtectedRoute>
      <AiChatPageContent />
    </ProtectedRoute>
  );
}

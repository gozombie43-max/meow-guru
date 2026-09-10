'use client';

import { AiChatIcon } from '@/components/AiChatIcon';
import { aiChatStyles } from './ai-chat.styles';
import { useAiChatHistory } from './useAiChatHistory';
import ProtectedRoute from '@/components/ProtectedRoute';
import VisualResponse from '@/components/ai/VisualResponse';
import RiskyWidgetBoundary from '@/components/RiskyWidgetBoundary';
import { useThemeMode } from '@/hooks/useTheme';
import api from '@/lib/axios';
import { waitForTutorJob, TutorJobError } from '@/lib/tutor-jobs';
import { announceFeedback } from '@/lib/feedback';
import {
ArrowUp,
Copy,
FileText,
Image as ImageIcon,
Menu,
Mic,
PanelLeft,
Plus,
Search,
Trash2,
X
} from 'lucide-react';
import NextImage from 'next/image';
import { isAxiosError } from 'axios';
import { type ChangeEvent,type MouseEvent as ReactMouseEvent,useEffect,useMemo,useRef,useState } from 'react';

import {
  ASSISTANT_CONTEXT,
  createChatId,
  normalizeSimpleTables,
  normalizeTutorMarkdown,
  type ChatSession,
} from './formatting';
function AiChatPageContent() {
  const { theme } = useThemeMode();
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 900;
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    activeChatId,
    chatSessions,
    isHistoryLoading,
    isLoading,
    messages,
    pendingKey,
    pollingRef,
    saveSessionMessages,
    setActiveChatId,
    setChatSessions,
    setIsLoading,
    setMessages,
  } = useAiChatHistory();

  const context = useMemo(() => ASSISTANT_CONTEXT, []);

  useEffect(() => {
    const body = document.body;
    body.classList.add('ai-chat-route');
    return () => body.classList.remove('ai-chat-route');
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    };
  }, [attachmentPreview]);

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setCopiedIndex(null);
    clearAttachment();
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
    const fileToSend = attachmentFile;
    if ((!text && !fileToSend) || isLoading) return;

    const chatId = activeChatId || createChatId();
    const previousMessages = activeChatId ? messages : [];
    const displayText = [
      fileToSend ? `Attached: ${fileToSend.name}` : '',
      text || (fileToSend ? 'Please solve the attached question.' : ''),
    ]
      .filter(Boolean)
      .join('\n');
    const userMessages = [...previousMessages, { role: 'user' as const, content: displayText }];

    if (!activeChatId) setActiveChatId(chatId);
    setInput('');
    removeAttachment();
    setMessages(userMessages);
    saveSessionMessages(chatId, userMessages, text || fileToSend?.name || 'Attached question');
    setIsLoading(true);

    try {
      let reply = '';
      if (fileToSend) {
        const formData = new FormData();
        formData.append('context', context);
        formData.append('message', text || 'Please solve the attached question.');
        formData.append('history', JSON.stringify(previousMessages.slice(-16)));
        formData.append('attachment', fileToSend);

        const response = await api.post('/api/ai/tutor-chat', formData, {
          headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': createChatId() },
          timeout: 60000,
        });
        if (response.data?.jobId) {
          if (pendingKey) sessionStorage.setItem(pendingKey, JSON.stringify({ jobId: response.data.jobId, chatId, title: text || fileToSend.name, messages: userMessages }));
          pollingRef.current = new AbortController();
          reply = await waitForTutorJob(response.data.jobId, pollingRef.current.signal);
          if (pendingKey) sessionStorage.removeItem(pendingKey);
        } else reply =
          response.data?.reply ||
          response.data?.explanation ||
          'I could not generate a response. Please try again.';
      } else {
        const response = await api.post(
          '/api/ai/tutor-chat',
          {
            context,
            message: text,
            history: previousMessages.slice(-16),
          },
          {
            timeout: 60000,
          }
        );
        reply =
          response.data?.reply ||
          response.data?.explanation ||
          'I could not generate a response. Please try again.';
      }

      const nextMessages = [...userMessages, { role: 'bot' as const, content: normalizeSimpleTables(reply) }];
      setMessages(nextMessages);
      saveSessionMessages(chatId, nextMessages, text || fileToSend?.name || 'Attached question');
    } catch (err: unknown) {
      if ((err instanceof Error && err.name === 'AbortError') || (isAxiosError(err) && err.code === 'ERR_CANCELED')) return;
      if (err instanceof TutorJobError && err.terminal && pendingKey) sessionStorage.removeItem(pendingKey);
      const errorMessage =
        (isAxiosError<{ error?: string }>(err) ? err.response?.data?.error : undefined) ||
        (err instanceof Error ? err.message : '') ||
        'I could not reach the tutor service. Check the backend connection and try again.';
      const nextMessages = [
        ...userMessages,
        {
          role: 'bot' as const,
          content: errorMessage,
        },
      ];
      setMessages(nextMessages);
      saveSessionMessages(chatId, nextMessages, text || fileToSend?.name || 'Attached question');
    } finally {
      setIsLoading(false);
    }
  }

  const starterPrompts = [
    'Mensuration formula revision',
    'Percentage shortcut method',
    'Current affairs quick quiz',
    'Cloze test strategy',
  ];

  const hasInput = input.trim().length > 0 || Boolean(attachmentFile);
  const hasMessages = messages.length > 0;
  const visibleSessions = chatSessions.filter((session) =>
    session.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const handleSend = () => {
    if (!hasInput || isLoading) return;
    sendMessage();
  };

  const handleStarterPrompt = (event: ReactMouseEvent<HTMLButtonElement>) => {
    void sendMessage(event.currentTarget.dataset.prompt);
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      announceFeedback('Copy successful');
      setTimeout(() => setCopiedIndex(null), 1800);
    } catch {
      setCopiedIndex(null);
    }
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    setAttachmentError('');
    setAttachmentPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const removeAttachment = () => {
    clearAttachment();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isAllowed = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isAllowed) {
      setAttachmentError('Upload an image or PDF file.');
      event.target.value = '';
      return;
    }

    if (file.size > 18 * 1024 * 1024) {
      setAttachmentError('File must be under 18 MB.');
      event.target.value = '';
      return;
    }

    setAttachmentError('');
    setAttachmentFile(file);
    setAttachmentPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    });
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
    <main className={`ai-chat-page ios-theme-${theme} ${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`ai-sidebar${sidebarOpen ? '' : ' is-collapsed'}`} aria-label="AI chat sidebar">
        <div className="sidebar-head">
          <button data-ui-button="icon" className="icon-btn" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle sidebar">
            <PanelLeft size={18} />
          </button>
          <button data-ui-button="state" className="new-chat" type="button" onClick={startNewChat}>
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
          <div className="section-label">{isHistoryLoading || visibleSessions.length > 0 ? 'Saved chats' : 'Start with'}</div>
          {isHistoryLoading ? (
            <div className="history-skeletons" aria-busy="true" aria-label="Loading chat history">
              <span className="sr-only" role="status">Loading chat history</span>
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </div>
          ) : visibleSessions.length > 0
            ? visibleSessions.map((session) => (
                <button data-ui-button="state"
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
                <button data-ui-button="state" className="history-item" type="button" key={prompt} data-prompt={prompt} onClick={handleStarterPrompt}>
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

      <section className={`chat-workspace ${!hasMessages ? 'is-empty' : ''}`} aria-label="AI Tutor chat">
        <header data-ui-chrome="header" className="chat-topbar">
          <div className="topbar-left">
            <button data-ui-button="icon" className="mobile-menu icon-btn" type="button" onClick={() => setSidebarOpen((value) => !value)} aria-label="Open sidebar">
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
          <button data-ui-button="secondary" className="clear-btn" type="button" onClick={handleClear} disabled={!hasMessages && !input}>
            <Trash2 size={16} />
            Clear
          </button>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          {!hasMessages ? (
            <section className="welcome-panel">
              <AiChatIcon size={48} style={{ color: 'var(--ink)', display: 'block', margin: '0 auto 16px auto' }} />
              <h1>How can I help you study today?</h1>
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
                      <div className="answer-card">
                        <div className="answer-head">
                          <span>AI Response</span>
                          <button data-ui-button="state" type="button" onClick={() => handleCopy(message.content, index)} title="Copy entire AI response">
                            <Copy size={15} />
                            {copiedIndex === index ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="answer-body ai-message-content">
                          <RiskyWidgetBoundary label="AI response">
                            <VisualResponse
                              content={message.content}
                              normalizeMarkdown={normalizeTutorMarkdown}
                            />
                          </RiskyWidgetBoundary>
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
            {(attachmentFile || attachmentError) && (
              <div className="attachment-panel">
                {attachmentFile && (
                  <div className="attachment-chip">
                    {attachmentPreview ? (
                      <div className="image-preview-wrapper" onClick={() => setIsPreviewModalOpen(true)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                        <NextImage
                          className="attachment-thumb"
                          src={attachmentPreview}
                          alt=""
                          width={60}
                          height={60}
                          unoptimized
                        />
                        <button data-ui-button="state" type="button" className="remove-image-btn" onClick={(e) => { e.stopPropagation(); removeAttachment(); }} aria-label="Remove attachment">
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <div className="file-preview-wrapper">
                        <span className="file-icon">
                          {attachmentFile.type === 'application/pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}
                        </span>
                        <div className="file-info">
                          <strong>{attachmentFile.name}</strong>
                          <span>{attachmentFile.type === 'application/pdf' ? 'PDF document' : 'Question image'}</span>
                        </div>
                        <button data-ui-button="state" type="button" className="remove-file-btn" onClick={removeAttachment} aria-label="Remove attachment">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {attachmentError && <div className="attachment-error">{attachmentError}</div>}
              </div>
            )}
            
            <div className="composer-row">
              <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleAttachmentChange}
               aria-label="Choose file"/>
              <button data-ui-button="state"
                className="composer-tool clip-btn"
                type="button"
                aria-label="Attach question image or PDF"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach image or PDF"
              >
                <Plus size={22} />
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
                placeholder="Ask ChatGPT"
                rows={1}
                disabled={isLoading}
               aria-label="Ask ChatGPT"/>
              <button data-ui-button="state" className="composer-tool mic-btn" type="button" aria-label="Voice input">
                <Mic size={20} />
              </button>
              <button data-ui-button="primary" className="send-btn" type="submit" disabled={!hasInput || isLoading} aria-label="Send message">
                <ArrowUp size={20} className="send-icon" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </form>
      </section>

      {isPreviewModalOpen && attachmentPreview && (
        <div className="image-modal-overlay" role="dialog" aria-modal="true" aria-label="Image preview">
          <div className="image-modal-content">
            <button data-ui-button="state" className="image-modal-close" onClick={() => setIsPreviewModalOpen(false)} aria-label="Close image preview">
              <X size={24} />
            </button>
            <img src={attachmentPreview} alt="Preview" className="image-modal-img" />
          </div>
        </div>
      )}

      <style jsx>{aiChatStyles}</style>
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

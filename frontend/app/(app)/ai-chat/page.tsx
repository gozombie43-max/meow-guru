'use client';

import { Dialog } from "@/components/ui/Dialog";
import { AiChatIcon } from '@/components/AiChatIcon';
import BackButton from "@/components/BackButton";
import RiskyWidgetBoundary from '@/components/RiskyWidgetBoundary';
import { useBackLayer } from "@/hooks/useAppNavigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useThemeMode } from '@/hooks/useTheme';
import api from '@/shared/api/client';
import { announceFeedback } from '@/lib/feedback';
import { TutorJobError } from '@/lib/tutor-job-error';
import { isAxiosError } from 'axios';
import {
Copy,
Menu,
PanelLeft,
Plus,
Search,
Trash2,
X
} from 'lucide-react';
import { useEffect,useMemo,useRef,useState,type ChangeEvent,type MouseEvent as ReactMouseEvent } from 'react';
import styles from './AiChat.module.css';
import { bindStyleClasses } from '@/lib/styleClasses';
import './AiChat.globals.css';

const styleClasses = bindStyleClasses(styles);
import { useAiChatHistory } from './useAiChatHistory';
import { ChatComposer, type ChatComposerHandle } from './ChatComposer';
import { MessageWindow } from '@/components/chat/MessageWindow';
import dynamic from 'next/dynamic';

const VisualResponse = dynamic(() => import('@/components/ai/VisualResponse'), {
  ssr: false,
  loading: () => <div className={styleClasses("answer-loading")} aria-label="Loading response" />,
});

import {
ASSISTANT_CONTEXT,
createChatId,
normalizeSimpleTables,
normalizeTutorMarkdown,
type ChatSession,
} from './formatting';
function AiChatPageContent() {
  const { theme } = useThemeMode();
  const [hasDraft, setHasDraft] = useState(false);
  const composerRef = useRef<ChatComposerHandle>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  // The media-query hook starts with the same value during SSR and hydration.
  // A user choice takes precedence over the responsive default afterward.
  const [sidebarOpenOverride, setSidebarOpen] = useState<boolean | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const isMobileSidebar = useMediaQuery("(max-width: 900px)");
  const sidebarOpen = sidebarOpenOverride ?? !isMobileSidebar;
  useBackLayer(sidebarOpen && isMobileSidebar, () => setSidebarOpen(false));
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    activeChatId,
    cancelSessionLoad,
    loadSession,
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
    if (isLoading) return;
    cancelSessionLoad();
    setActiveChatId(null);
    setMessages([]);
    composerRef.current?.clear();
    setCopiedIndex(null);
    clearAttachment();
  };

  const openChat = (session: ChatSession) => {
    if (isLoading) return;
    setActiveChatId(session.id);
    void loadSession(session);
    composerRef.current?.clear();
    setCopiedIndex(null);
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setSidebarOpen(false);
    }
  };

  async function sendMessage(nextText?: string) {
    const text = (nextText ?? '').trim();
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
    composerRef.current?.clear();
    removeAttachment();
    setMessages(userMessages.slice(-80));
    void saveSessionMessages(chatId, userMessages, text || fileToSend?.name || 'Attached question');
    setIsLoading(true);

    try {
      const { tutorRequestSchema, tutorReplySchema, tutorJobResponseSchema } = await import('@meow/contracts/tutor');
      tutorRequestSchema.parse({ context, message: text || 'Please solve the attached question.', history: previousMessages.slice(-16) });
      let reply = '';
      let queuedJob = false;
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
          queuedJob = true;
          tutorJobResponseSchema.parse(response.data);
          if (pendingKey) sessionStorage.setItem(pendingKey, JSON.stringify({ jobId: response.data.jobId, chatId, title: text || fileToSend.name, messages: userMessages }));
          pollingRef.current = new AbortController();
          const { waitForTutorJob } = await import('@/lib/tutor-jobs');
          reply = await waitForTutorJob(response.data.jobId, pollingRef.current.signal);
        } else reply = tutorReplySchema.parse(response.data).reply;
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
        reply = tutorReplySchema.parse(response.data).reply;
      }

      const nextMessages = [...userMessages, { role: 'bot' as const, content: normalizeSimpleTables(reply) }];
      setMessages(nextMessages.slice(-80));
      const saved = await saveSessionMessages(chatId, nextMessages, text || fileToSend?.name || 'Attached question');
      if (queuedJob && saved && pendingKey) sessionStorage.removeItem(pendingKey);
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
      setMessages(nextMessages.slice(-80));
      void saveSessionMessages(chatId, nextMessages, text || fileToSend?.name || 'Attached question');
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

  const hasMessages = messages.length > 0;
  const visibleSessions = chatSessions.filter((session) =>
    session.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

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

    if (file.size > 8 * 1024 * 1024) {
      setAttachmentError('File must be under 8 MB.');
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
    <main data-theme={theme} className={styleClasses(`ai-chat-page ios-theme-${theme} ${sidebarOpen ? '' : ' sidebar-collapsed'}`)}>
      {sidebarOpen && (
        <button
          type="button"
          className={styleClasses("sidebar-backdrop")}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={styleClasses(`ai-sidebar${sidebarOpen ? '' : ' is-collapsed'}`)} aria-label="AI chat sidebar">
        <div className={styleClasses("sidebar-head")}>
          <button data-ui-button="icon" className={styleClasses("icon-btn")} type="button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
            <PanelLeft size={18} />
          </button>
          <button data-ui-button="state" className={styleClasses("new-chat")} type="button" onClick={startNewChat}>
            <Plus size={17} />
            <span>New chat</span>
          </button>
        </div>

        <div className={styleClasses("sidebar-search")}>
          <Search size={16} />
          <input
            placeholder="Search chats"
            aria-label="Search chats"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className={styleClasses("sidebar-section")}>
          <div className={styleClasses("section-label")}>{isHistoryLoading || visibleSessions.length > 0 ? 'Saved chats' : 'Start with'}</div>
          {isHistoryLoading ? (
            <div className={styleClasses("history-skeletons")} aria-busy="true" aria-label="Loading chat history">
              <span className={styleClasses("sr-only")} role="status">Loading chat history</span>
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </div>
          ) : visibleSessions.length > 0
            ? visibleSessions.map((session) => (
                <button data-ui-button="state"
                  className={styleClasses(`history-item${session.id === activeChatId ? ' is-active' : ''}`)}
                  type="button"
                  key={session.id}
                  onClick={() => openChat(session)}
                  title={session.title}
                >
                  <span>{session.title}</span>
                </button>
              ))
            : starterPrompts.map((prompt) => (
                <button data-ui-button="state" className={styleClasses("history-item")} type="button" key={prompt} data-prompt={prompt} onClick={handleStarterPrompt}>
                  <span>{prompt}</span>
                </button>
              ))}
        </div>

        <div className={styleClasses("sidebar-footer")}>
          <div className={styleClasses("mini-avatar")}>AI</div>
          <div>
            <strong>SSC Tutor</strong>
            <span>Desktop mode</span>
          </div>
        </div>
      </aside>

      <section className={styleClasses(`chat-workspace ${!hasMessages ? 'is-empty' : ''}`)} aria-label="AI Tutor chat">
        <header data-ui-chrome="header" className={styleClasses("chat-topbar")}>
          <div className={styleClasses("topbar-left")}>
            <div className={styleClasses("desktop-back")}>
              <BackButton href="/" label="Back to home" className={styleClasses("icon-btn")} />
            </div>
            <button data-ui-button="icon" className={styleClasses("mobile-menu icon-btn")} type="button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open sidebar">
              <Menu size={19} />
            </button>
            <div className={styleClasses("chat-heading")}>
              <div className={styleClasses("chat-title")}>AI Tutor</div>
              <div className={styleClasses("chat-status")}>
                <span />
                SSC CGL and CHSL study assistant
              </div>
            </div>
          </div>
          <button data-ui-button="secondary" className={styleClasses("clear-btn")} type="button" onClick={handleClear} disabled={!hasMessages && !hasDraft}>
            <Trash2 size={16} />
            Clear
          </button>
        </header>

        <div className={styleClasses("chat-scroll")} ref={scrollRef}>
          {!hasMessages ? (
            <section className={styleClasses("welcome-panel")}>
              <AiChatIcon size={48} style={{ color: 'var(--ink)', display: 'block', margin: '0 auto 16px auto' }} />
              <h1>How can I help you study today?</h1>
            </section>
          ) : (
            <div className={styleClasses("message-list")}>
              <MessageWindow messages={messages} key={activeChatId ?? 'new'}>
              {(message, index) => {
                if (message.role === 'user') {
                  return (
                    <article className={styleClasses("message-row user-row")} key={`${message.role}-${index}`}>
                      <div className={styleClasses("message-bubble user-bubble")}>{message.content}</div>
                    </article>
                  );
                }

                return (
                  <article className={styleClasses("message-row assistant-row")} key={`${message.role}-${index}`}>
                    <div className={styleClasses("assistant-avatar")}>AI</div>
                    <div className={styleClasses("assistant-message")}>
                      <div className={styleClasses("answer-card")}>
                        <div className={styleClasses("answer-head")}>
                          <span>AI Response</span>
                          <button data-ui-button="state" type="button" onClick={() => handleCopy(message.content, index)} title="Copy entire AI response">
                            <Copy size={15} />
                            {copiedIndex === index ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className={styleClasses("answer-body ai-message-content")}>
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
              }}
              </MessageWindow>

              {isLoading && (
                <article className={styleClasses("message-row assistant-row")}>
                  <div className={styleClasses("assistant-avatar")}>AI</div>
                  <div className={styleClasses("typing-card")} aria-label="AI Tutor is typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              )}
            </div>
          )}
        </div>

        <ChatComposer
          ref={composerRef}
          isLoading={isLoading}
          attachmentFile={attachmentFile}
          attachmentPreview={attachmentPreview}
          attachmentError={attachmentError}
          fileInputRef={fileInputRef}
          onAttachmentChange={handleAttachmentChange}
          onRemoveAttachment={removeAttachment}
          onPreview={() => setIsPreviewModalOpen(true)}
          onSend={sendMessage}
          onDraftPresenceChange={setHasDraft}
        />
      </section>

      {isPreviewModalOpen && attachmentPreview && (
        <Dialog onClose={() => setIsPreviewModalOpen(false)} className={styleClasses("image-modal-overlay")} role="dialog" aria-modal="true" aria-label="Image preview">
          <div className={styleClasses("image-modal-content")}>
            <button data-ui-button="state" data-ui-shape="icon" className={styleClasses("image-modal-close")} onClick={() => setIsPreviewModalOpen(false)} aria-label="Close image preview">
              <X size={24} />
            </button>
            <img src={attachmentPreview} alt="Preview" className={styleClasses("image-modal-img")} />
          </div>
        </Dialog>
      )}
    </main>
  );
}

export default function AiChatPage() {
  return <AiChatPageContent />;
}

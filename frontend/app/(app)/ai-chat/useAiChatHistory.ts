'use client';

import { useAuth } from '@/context/AuthContext';
import api from '@/shared/api/client';
import { TutorJobError } from '@/lib/tutor-job-error';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatTitle, type ChatMessage, type ChatSession } from './formatting';

export function useAiChatHistory() {
  const { user } = useAuth();
  const pendingKey = user?.id ? `tutor-pending:${user.id}` : 'tutor-pending:anonymous';
  const pollingRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const observed = useRef(new Map<string, ChatMessage[]>());
  const revisions = useRef(new Map<string, number>());
  const queues = useRef(new Map<string, { pending: ChatMessage[]; running?: Promise<void> }>());
  const activeRequest = useRef(0);

  const persistSession = useCallback(async (session: ChatSession) => {
    if (!user?.id) return;
    const nextMessages = session.messages.slice(-80);
    const previous = observed.current.get(session.id) ?? [];
    // Find the retained suffix, including conversations trimmed to the 80-message limit.
    let overlap = Math.min(previous.length, nextMessages.length);
    while (overlap > 0 && !previous.slice(-overlap).every((message, i) =>
      message.role === nextMessages[i].role && message.content === nextMessages[i].content)) overlap--;
    const added = nextMessages.slice(overlap).map(message => ({ ...message, content: message.content.slice(0, 12000) }));
    observed.current.set(session.id, nextMessages);
    const queue = queues.current.get(session.id) ?? { pending: [] };
    queues.current.set(session.id, queue);
    queue.pending.push(...added);
    if (!queue.running) {
      queue.running = (async () => {
        while (queue.pending.length) {
          const batch = queue.pending.slice(0, 80);
          const sequence = (revisions.current.get(session.id) ?? 0) + 1;
          const { data } = await api.post(`/users/me/ai-chats/${encodeURIComponent(session.id)}/messages`, {
            title: session.title.slice(0, 80), messages: batch, sequence,
          });
          revisions.current.set(session.id, data.revision ?? sequence - 1 + batch.length);
          queue.pending.splice(0, batch.length);
        }
      })().finally(() => { queue.running = undefined; });
    }
    await queue.running;
  }, [user?.id]);

  const loadSession = async (session: ChatSession) => {
    const request = ++activeRequest.current;
    setActiveChatId(session.id);
    setIsLoading(true);
    try {
      const queue = queues.current.get(session.id);
      if (queue?.pending.length) await persistSession({ ...session, messages: observed.current.get(session.id) ?? [] });
      else await queue?.running;
      const { data } = await api.get(`/users/me/ai-chats/${encodeURIComponent(session.id)}`);
      if (request !== activeRequest.current) return;
      const chat = data.aiChat as ChatSession;
      observed.current.set(chat.id, chat.messages);
      revisions.current.set(chat.id, chat.revision ?? chat.messages.length);
      setMessages(chat.messages);
    } catch (error) {
      if (request === activeRequest.current) setMessages([{ role: 'bot', content: 'Could not load this chat. Please try again.' }]);
      console.warn('Could not load AI chat', error);
    } finally { if (request === activeRequest.current) setIsLoading(false); }
  };

  const cancelSessionLoad = () => {
    activeRequest.current++;
    setIsLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    observed.current.clear();
    revisions.current.clear();
    queues.current.clear();
    activeRequest.current++;
    const loadBackendChats = async () => {
      try {
        if (user?.id) {
          const { data } = await api.get('/users/me/ai-chats');
          if (cancelled) return;
          const backendChats = Array.isArray(data.aiChats) ? (data.aiChats as ChatSession[]) : [];
          setChatSessions(backendChats.map(chat => ({ ...chat, messages: [] })));
          for (const chat of backendChats) revisions.current.set(chat.id, chat.revision ?? 0);
        }
        setIsHistoryLoading(false);
        const pending = sessionStorage.getItem(pendingKey);
        if (!pending) return;

        const saved = JSON.parse(pending) as {
          jobId: string;
          chatId: string;
          title: string;
          messages: ChatMessage[];
        };
        if (user?.id) {
          try {
            const { data } = await api.get(`/users/me/ai-chats/${encodeURIComponent(saved.chatId)}`);
            if (cancelled) return;
            observed.current.set(saved.chatId, data.aiChat.messages);
            revisions.current.set(saved.chatId, data.aiChat.revision ?? data.aiChat.messages.length);
          } catch (error) {
            if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
          }
        }
        setActiveChatId(saved.chatId);
        setMessages(saved.messages);
        setIsLoading(true);
        pollingRef.current = new AbortController();
        try {
          const { waitForTutorJob } = await import('@/lib/tutor-jobs');
          if (cancelled) return;
          const reply = await waitForTutorJob(saved.jobId, pollingRef.current.signal);
          if (cancelled) return;
          const updated: ChatSession = {
            id: saved.chatId,
            title: saved.title,
            messages: [...saved.messages, { role: 'bot', content: reply }],
            updatedAt: new Date().toISOString(),
          };
          await persistSession(updated);
          if (cancelled) return;
          setMessages(updated.messages.slice(-80));
          setChatSessions((previous) => [{ ...updated, messages: [] }, ...previous.filter((chat) => chat.id !== updated.id)].slice(0, 30));
          sessionStorage.removeItem(pendingKey);
        } catch (error) {
          if (cancelled) return;
          if (error instanceof TutorJobError && error.terminal) sessionStorage.removeItem(pendingKey);
          setMessages([
            ...saved.messages,
            {
              role: 'bot',
              content: error instanceof Error
                ? error.message
                : 'Could not check the attachment. Refresh to retry.',
            },
          ]);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      } catch (error) {
        console.warn('Could not load AI chat history', error);
      } finally {
        if (!cancelled) setIsHistoryLoading(false);
      }
    };

    void loadBackendChats();
    return () => {
      cancelled = true;
      pollingRef.current?.abort();
    };
  }, [pendingKey, user?.id, persistSession]);

  const saveSessionMessages = (chatId: string, nextMessages: ChatMessage[], firstUserMessage: string) => {
    const session: ChatSession = { id: chatId,
      title: chatSessions.find(chat => chat.id === chatId)?.title || getChatTitle(firstUserMessage),
      messages: nextMessages.slice(-80), updatedAt: new Date().toISOString() };
    setChatSessions(previous => [{ ...session, messages: [] }, ...previous.filter(chat => chat.id !== chatId)].slice(0, 30));
    return persistSession(session).then(() => true, error => {
      console.warn('Could not save AI chat history', error);
      return false;
    });
  };

  return {
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
  };
}

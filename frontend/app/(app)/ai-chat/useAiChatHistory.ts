'use client';

import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';
import { TutorJobError, waitForTutorJob } from '@/lib/tutor-jobs';
import { useEffect, useRef, useState } from 'react';
import { getChatTitle, type ChatMessage, type ChatSession } from './formatting';

export function useAiChatHistory() {
  const { user } = useAuth();
  const pendingKey = user?.id ? `tutor-pending:${user.id}` : null;
  const pollingRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;
    const loadBackendChats = async () => {
      try {
        const { data } = await api.get('/users/me/ai-chats');
        if (cancelled) return;
        const backendChats = Array.isArray(data.aiChats) ? (data.aiChats as ChatSession[]) : [];
        setChatSessions(backendChats);
        setIsHistoryLoading(false);
        const pending = sessionStorage.getItem(pendingKey);
        if (!pending) return;

        const saved = JSON.parse(pending) as {
          jobId: string;
          chatId: string;
          title: string;
          messages: ChatMessage[];
        };
        setActiveChatId(saved.chatId);
        setMessages(saved.messages);
        setIsLoading(true);
        pollingRef.current = new AbortController();
        try {
          const reply = await waitForTutorJob(saved.jobId, pollingRef.current.signal);
          if (cancelled) return;
          const updated: ChatSession = {
            id: saved.chatId,
            title: saved.title,
            messages: [...saved.messages, { role: 'bot', content: reply }],
            updatedAt: new Date().toISOString(),
          };
          await api.put(`/users/me/ai-chats/${encodeURIComponent(saved.chatId)}`, {
            title: updated.title,
            messages: updated.messages,
          });
          if (cancelled) return;
          setMessages(updated.messages);
          setChatSessions((previous) => [updated, ...previous.filter((chat) => chat.id !== updated.id)]);
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
  }, [pendingKey]);

  const persistSession = async (session: ChatSession) => {
    try {
      await api.put(`/users/me/ai-chats/${encodeURIComponent(session.id)}`, {
        title: session.title,
        messages: session.messages,
      });
    } catch (error) {
      console.warn('Could not save AI chat history', error);
    }
  };

  const saveSessionMessages = (chatId: string, nextMessages: ChatMessage[], firstUserMessage: string) => {
    let sessionToPersist: ChatSession | null = null;
    setChatSessions((previous) => {
      const existing = previous.find((session) => session.id === chatId);
      const nextSession: ChatSession = {
        id: chatId,
        title: existing?.title || getChatTitle(firstUserMessage),
        messages: nextMessages,
        updatedAt: new Date().toISOString(),
      };
      sessionToPersist = nextSession;
      return [nextSession, ...previous.filter((session) => session.id !== chatId)].slice(0, 30);
    });
    queueMicrotask(() => {
      if (sessionToPersist) void persistSession(sessionToPersist);
    });
  };

  return {
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
  };
}

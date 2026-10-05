'use client';

import { useState, type ReactNode } from 'react';
import styles from './MessageWindow.module.css';

const WINDOW_SIZE = 20;

// Keep every message available while bounding the mounted Markdown/math tree.
export function MessageWindow<T>({ messages, children }: {
  messages: readonly T[];
  children: (message: T, index: number) => ReactNode;
}) {
  const [range, setRange] = useState<{ count: number; end: number | null }>({ count: messages.length, end: null });
  // A new reply returns to the latest messages without a second effect/render.
  const olderEnd = range.count === messages.length ? range.end : null;
  const setOlderEnd = (end: number | null) => setRange({ count: messages.length, end });
  const end = Math.min(olderEnd ?? messages.length, messages.length);
  const start = Math.max(0, end - WINDOW_SIZE);
  const showLatest = end === messages.length;

  return (
    <>
      {messages.length > WINDOW_SIZE && (
        <nav className={styles.navigation} aria-label="Conversation messages">
          <button type="button" data-ui-button="secondary" disabled={start === 0}
            onClick={() => setOlderEnd(start)}>Earlier messages</button>
          <span aria-live="polite">{start + 1}–{end} of {messages.length}</span>
          <button type="button" data-ui-button="secondary" disabled={showLatest}
            onClick={() => setOlderEnd(end + WINDOW_SIZE >= messages.length ? null : end + WINDOW_SIZE)}>Newer messages</button>
          {!showLatest && <button type="button" data-ui-button="secondary" onClick={() => setOlderEnd(null)}>Latest messages</button>}
        </nav>
      )}
      {messages.slice(start, end).map((message, index) => children(message, start + index))}
    </>
  );
}

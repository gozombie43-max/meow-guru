'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { StudyModeCard } from './study-mode-comparison-model';
import styles from './comparison-word-index.module.css';

export const ComparisonWordIndex = memo(function ComparisonWordIndex({ cards, activeId, onSelect, numbers, compact = false }: {
  cards: StudyModeCard[]; activeId?: string; onSelect: (id: string) => void; numbers?: ReadonlyMap<string, number>; compact?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });
  const rowHeight = compact ? 48 : 72;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewport(value => ({ ...value, height: element.clientHeight })));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const index = cards.findIndex(card => card.id === activeId);
    const top = Math.max(0, index) * rowHeight;
    if (index < 0 || top < element.scrollTop || top + rowHeight > element.scrollTop + element.clientHeight) {
      element.scrollTop = Math.max(0, top - element.clientHeight / 2 + rowHeight / 2);
    }
    setViewport(value => ({ ...value, top: element.scrollTop }));
  }, [cards, activeId, rowHeight]);
  const start = Math.max(0, Math.min(Math.floor(viewport.top / rowHeight) - 5, Math.max(0, cards.length - 1)));
  const end = Math.min(cards.length, start + Math.ceil(viewport.height / rowHeight) + 10);
  return <div ref={root} className={`${styles.scroll} ${compact ? styles.compact : ''}`} aria-label="Word index" onScroll={event => {
    const top = event.currentTarget.scrollTop;
    setViewport(value => ({ ...value, top }));
  }}>
    {cards.length === 0 ? <p className={styles.empty}>No matching words. Try another search or letter.</p> : <div style={{ height: cards.length * rowHeight, position: 'relative' }}>
      {cards.slice(start, end).map((card, offset) => <button key={card.id} data-index={start + offset} data-ui-button="state" className={styles.row} aria-current={card.id === activeId ? 'true' : undefined} style={{ top: (start + offset) * rowHeight, height: rowHeight - 4 }} onClick={() => onSelect(card.id)} onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : Math.min(cards.length - 1, Math.max(0, start + offset + (event.key === 'ArrowDown' ? 1 : -1)));
        if (root.current) {
          root.current.scrollTop = next * rowHeight;
          setViewport(value => ({ ...value, top: next * rowHeight }));
          requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus({ preventScroll: true }));
        }
      }}>
        <span className={styles.number} aria-hidden="true">{numbers?.get(card.id) ?? start + offset + 1}</span>
        <span className={styles.copy}><strong>{card.word}</strong>{!compact && <small>{card.meanings[0]?.translation || card.meanings[0]?.definition}</small>}</span>
        <span className={styles.pos}>{card.meanings[0]?.pos}</span>
      </button>)}
    </div>}
  </div>;
});

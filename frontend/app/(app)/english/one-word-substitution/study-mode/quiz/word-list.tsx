'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark } from 'lucide-react';
import { SpeakerBtn } from '../../../_shared/SpeakerBtn';
import type { StudyModeTermCard } from '../../../_shared/useStudyModeTerms';
import styles from './study-library.module.css';

const WordCard = memo(function WordCard({ card, index, isSaved, translations, storageReady, toggleSave }: {
  card: StudyModeTermCard; index: number; isSaved: boolean; translations: boolean;
  storageReady: boolean; toggleSave: (id: string) => void;
}) {
  const [definition, ...hooks] = card.prompt.split(/Memory hook:/i);
  return <article className={styles.card} >
                <div className={styles.cardMeta}><span>{String(index + 1).padStart(2, '0')}<i />{card.label || 'General'}</span><button data-ui-button="state" data-ui-shape="icon" disabled={!storageReady} aria-label={`${isSaved ? 'Unsave' : 'Save'} ${card.answer}`} aria-pressed={isSaved} onClick={() => toggleSave(card.id)}><Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'} /></button></div>
                <div className={styles.word}><h3>{card.answer}</h3><SpeakerBtn text={card.answer} size={44} /></div>
                {translations && card.answerTranslation && <p className={styles.wordTranslation} lang="bn">{card.answerTranslation}</p>}
                <div className={styles.definition}><p>{definition.trim()}</p><SpeakerBtn text={definition.trim()} size={44} /></div>
                {translations && card.definitionTranslation && <p className={styles.definitionTranslation} lang="bn">{card.definitionTranslation}</p>}
                {hooks.length > 0 && <details className={styles.memory}><summary>Memory hook<ArrowUpRight size={16} /></summary><p>{hooks.join('Memory hook:').trim()}</p></details>}
              </article>;
});

export const WordList = memo(function WordList({ cards, saved, translations, storageReady, toggleSave }: {
  cards: StudyModeTermCard[]; saved: Set<string>; translations: boolean;
  storageReady: boolean; toggleSave: (id: string) => void;
}) {
  const [count, setCount] = useState(40);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = count < cards.length;
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        setCount(value => value + 40);
      }
    }, { root: target.closest('main'), rootMargin: '400px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, count]);
  return <>
    <div className={styles.grid}>{cards.slice(0, count).map((card, index) => <WordCard key={card.id} card={card} index={index} isSaved={saved.has(card.id)} translations={translations} storageReady={storageReady} toggleSave={toggleSave} />)}</div>
    {hasMore && <div ref={sentinel} className={styles.loadMore}><button data-ui-button="secondary" onClick={() => setCount(value => value + 40)}>Show more words</button></div>}
  </>;
});

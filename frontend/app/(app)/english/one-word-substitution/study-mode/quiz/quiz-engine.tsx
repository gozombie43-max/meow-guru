'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, BookOpen, Search, SlidersHorizontal, Sun, Moon, X, Languages } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { useBackLayer } from '@/hooks/useAppNavigation';
import { useThemeMode } from '@/hooks/useTheme';
import { useQuestions } from '@/hooks/useQuestions';
import { normalizeStudyModeTerm } from '../../../_shared/useStudyModeTerms';
import { WordList } from './word-list';
import { flushSync } from 'react-dom';
import styles from './study-library.module.css';

export default function OneWordSubstitutionStudyEngine() {
  const { theme, toggleThemeMode } = useThemeMode();
  const { questions, isLoading, isError, mutate } = useQuestions({ subject: 'english', topic: 'one-word-substitution', questionType: 'study-mode' });
  const cards = useMemo(() => (questions ?? []).map((question, index) => normalizeStudyModeTerm({ ...question }, index)).filter(card => card !== null), [questions]);
  const [query, setQuery] = useState('');
  const searchQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('');
  const [letter, setLetter] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [translations, setTranslations] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const headerRef = useRef<HTMLElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem('ows-bookmarks') || '[]');
        if (Array.isArray(value)) setSaved(new Set(value.filter((id): id is string => typeof id === 'string')));
      } catch { /* Ignore unavailable or malformed browser storage. */ }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (storageReady) {
      try { localStorage.setItem('ows-bookmarks', JSON.stringify([...saved])); } catch { /* Saving remains available for this visit. */ }
    }
  }, [saved, storageReady]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    cards.forEach(card => counts.set(card.label || 'General', (counts.get(card.label || 'General') || 0) + 1));
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [cards]);
  const letters = useMemo(() => [...new Set(cards.map(card => card.answer[0]?.toUpperCase()).filter(Boolean))].sort(), [cards]);
  const indexedCards = useMemo(() => cards.map(card => ({ card, text: [card.answer, card.prompt, card.answerTranslation, card.definitionTranslation].filter(Boolean).join(' ').toLocaleLowerCase() })), [cards]);
  const visible = useMemo(() => indexedCards.filter(({ card, text }) =>
    (!category || (card.label || 'General') === category) && (!letter || card.answer.toUpperCase().startsWith(letter)) &&
    (!savedOnly || saved.has(card.id)) && (!searchQuery || text.includes(searchQuery))
  ).map(({ card }) => card), [indexedCards, category, letter, savedOnly, saved, searchQuery]);
  useBackLayer(filtersOpen, () => { setFiltersOpen(false); filterButtonRef.current?.focus(); });
  useEffect(() => {
    if (!filtersOpen) return;
    const dismiss = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) setFiltersOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => { document.removeEventListener('pointerdown', dismiss); };
  }, [filtersOpen]);
  const savedCount = cards.filter(card => saved.has(card.id)).length;
  const reset = () => { setQuery(''); setCategory(''); setLetter(''); setSavedOnly(false); };
  const toggleSave = useCallback((id: string) => setSaved(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);

  return (
    <div className={styles.page} data-theme={theme}>
      <header ref={headerRef} className={`${styles.header} ${searchOpen ? styles.searchOpen : ''}`} data-ui-chrome="header">
        <div className={styles.headerInner}>
          <BackButton href="/english/one-word-substitution/study-mode" label="Back to study setup" />
          <div className={styles.breadcrumb}><h1>One Word Substitution</h1><span>Study mode · {cards.length} words · {savedCount} saved</span></div>

          <button className={styles.desktopTheme} data-ui-button="icon" onClick={toggleThemeMode} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
        </div>
        <div className={styles.headerControls}>
            <div className={styles.toolbar}><button className={styles.mobileSearch} data-ui-button="icon" aria-label={searchOpen ? 'Close search' : 'Open search'} aria-expanded={searchOpen} onClick={() => { flushSync(() => setSearchOpen(!searchOpen)); if (!searchOpen) searchRef.current?.focus(); }}>{searchOpen ? <X /> : <Search />}</button><label className={styles.search}><Search size={20} /><input ref={searchRef} onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); }} aria-label="Search words or meanings" placeholder="Search a word or meaning…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button data-ui-button="icon" aria-label="Clear search" onClick={() => setQuery('')}><X size={18} /></button>}</label><button ref={filterButtonRef} data-ui-button="icon" aria-label={filtersOpen ? 'Hide filters' : 'Show filters'} aria-expanded={filtersOpen} aria-controls="library-filters" onClick={() => setFiltersOpen(!filtersOpen)}>{filtersOpen ? <X /> : <SlidersHorizontal />}</button><button className={styles.translationToggle} data-ui-button="state" aria-pressed={translations} onClick={() => setTranslations(!translations)}><Languages size={18} /><span>বাংলা</span></button></div>
          {filtersOpen && <div id="library-filters" className={styles.filterPanel}>
            <div className={styles.mobileSettings}>
              <button data-ui-button="secondary" onClick={toggleThemeMode}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
              <button data-ui-button="state" aria-pressed={translations} onClick={() => setTranslations(!translations)}><Languages size={18} /> বাংলা</button>
            </div>
            <div className={styles.collections}>
              <button data-ui-button="state" aria-pressed={!savedOnly} onClick={() => setSavedOnly(false)}><BookOpen size={18} /><span>All words</span><small>{cards.length}</small></button>
              <button data-ui-button="state" aria-pressed={savedOnly} onClick={() => setSavedOnly(true)}><Bookmark size={18} /><span>Saved words</span><small>{savedCount}</small></button>
            </div>
              <div className={styles.sectionLabel}>CATEGORIES<button data-ui-button="state" onClick={reset}>Reset</button></div>
              <div className={styles.categories}><button data-ui-button="state" aria-pressed={!category} onClick={() => setCategory('')}>All categories<span>{cards.length}</span></button>{categories.map(([name, count]) => <button key={name} data-ui-button="state" aria-pressed={category === name} onClick={() => setCategory(category === name ? '' : name)}>{name}<span>{count}</span></button>)}</div>
              <div className={styles.sectionLabel}>STARTS WITH</div><div className={styles.letters}>{letters.map(value => <button key={value} data-ui-button="state" aria-pressed={letter === value} onClick={() => setLetter(letter === value ? '' : value)}>{value}</button>)}</div>
          </div>}
        </div>
      </header>
      <main className={styles.main} aria-label="Scrollable study library">
        <section className={styles.library} aria-label="Vocabulary words">
            <div className={styles.results}><h2>{savedOnly ? 'Your saved words' : category || 'All words'}{letter ? ` · ${letter}` : ''}</h2><span role="status">{isLoading ? 'Loading…' : `${visible.length} ${visible.length === 1 ? 'word' : 'words'}`}</span></div>
            <div className={styles.wordList} aria-busy={query.trim().toLocaleLowerCase() !== searchQuery}>
            {isLoading ? <div className={styles.empty} role="status"><BookOpen /><h3>Opening your library…</h3><p>Your vocabulary is on its way.</p></div> : isError ? <div className={styles.empty} role="alert"><h3>Couldn’t load your words</h3><p>Please try loading the library again.</p><button data-ui-button="primary" onClick={() => void mutate()}>Try again</button></div> : visible.length === 0 ? <div className={styles.empty}><Search /><h3>{savedOnly ? 'No saved words here yet' : 'No words found'}</h3><p>{savedOnly ? 'Tap the bookmark on a word to keep it here.' : 'Try another search or clear your filters.'}</p><button data-ui-button="secondary" onClick={reset}>Show all words</button></div> : <WordList key={JSON.stringify([searchQuery, category, letter, savedOnly])} cards={visible} saved={saved} translations={translations} storageReady={storageReady} toggleSave={toggleSave} />}
            <p className={styles.endnote}>Read. Recall. Repeat.</p>
            </div>
        </section>
      </main>
    </div>
  );
}

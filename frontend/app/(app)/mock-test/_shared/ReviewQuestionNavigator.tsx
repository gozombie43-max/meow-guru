import { Check, X, Minus } from 'lucide-react';
import styles from './ReviewEngine.module.css';

export type ReviewFilter = 'all' | 'correct' | 'incorrect' | 'skipped';
export interface ReviewNavigationItem {
  question: { id: string };
  index: number;
  status: Exclude<ReviewFilter, 'all'>;
}

interface ReviewQuestionNavigatorProps {
  questions: ReviewNavigationItem[];
  filteredQuestions: ReviewNavigationItem[];
  filter: ReviewFilter;
  selectedIndex: number;
  onFilter: (filter: ReviewFilter) => void;
  onSelect: (index: number) => void;
}

export default function ReviewQuestionNavigator({ questions, filteredQuestions, filter, selectedIndex, onFilter, onSelect }: ReviewQuestionNavigatorProps) {
  const filters = [
    { key: 'all', label: 'All', count: questions.length },
    { key: 'correct', label: 'Correct', count: questions.filter(item => item.status === 'correct').length },
    { key: 'incorrect', label: 'Wrong', count: questions.filter(item => item.status === 'incorrect').length },
    { key: 'skipped', label: 'Skipped', count: questions.filter(item => item.status === 'skipped').length },
  ] as const;

  return <div className={styles.navigator}>
    <div className={styles.filterList} role="group" aria-label="Filter questions by status">
      {filters.map(item => <button
        key={item.key}
        className={`${styles.filterBtn} ${filter === item.key ? styles.activeFilter : ''}`}
        aria-pressed={filter === item.key}
        onClick={() => onFilter(item.key)}
      >{item.label}<span>{item.count}</span></button>)}
    </div>
    <div className={styles.paletteLegend}>
      <span className={styles.itemCorrect}><Check size={12} />Correct</span>
      <span className={styles.itemIncorrect}><X size={12} />Wrong</span>
      <span className={styles.itemSkipped}><Minus size={12} />Skipped</span>
    </div>
    <div className={styles.paletteGrid} aria-label="Question numbers">
      {filteredQuestions.map((item, index) => <button
        key={item.question.id}
        className={`${styles.paletteBtn} ${item.status === 'correct' ? styles.itemCorrect : item.status === 'incorrect' ? styles.itemIncorrect : styles.itemSkipped} ${index === selectedIndex ? styles.selectedPaletteBtn : ''}`}
        aria-label={`Question ${item.index + 1}, ${item.status}`}
        aria-current={index === selectedIndex ? 'true' : undefined}
        onClick={() => onSelect(index)}
      >{item.index + 1}</button>)}
    </div>
    {filteredQuestions.length === 0 && <p className={styles.paletteEmpty}>No {filter} questions in this section.</p>}
  </div>;
}

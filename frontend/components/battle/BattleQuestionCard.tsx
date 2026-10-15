'use client';

import { useEffect, useState } from 'react';
import RichContent from '@/components/RichContent';
import QuestionImage from '@/components/QuestionImage';
import { battleKeyIncludes, battlePicked, type BattleAnswer, type BattleQuestion, type Reveal } from '@/lib/battle-state';

export default function BattleQuestionCard({ question: q, answer, reveal, userId, disabled, onSubmit }: {
  question: BattleQuestion; answer: BattleAnswer | null; reveal: Reveal | null; userId: string;
  disabled: boolean; onSubmit: (answer: BattleAnswer) => void;
}) {
  const [indices, setIndices] = useState<number[]>([]);
  const [numeric, setNumeric] = useState('');
  const [remaining, setRemaining] = useState(() => q.deadline ? Math.max(0, Math.ceil((+new Date(q.deadline) - Date.now()) / 1000)) : null);
  useEffect(() => {
    if (!q.deadline) return;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((+new Date(q.deadline!) - Date.now()) / 1000))), 250);
    return () => window.clearInterval(timer);
  }, [q.deadline]);
  const type = q.type || 'mcq', locked = disabled || Boolean(reveal) || remaining === 0;
  const current = reveal?.answers?.[userId] ?? answer;
  const opponentId = Object.keys(reveal?.selections || {}).find(id => id !== userId);
  const opponent = opponentId ? reveal?.answers?.[opponentId] : null;
  const draft: BattleAnswer = { type: 'msq', selectedIndices: indices };
  const validNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(numeric.trim()) && Number.isFinite(Number(numeric));
  const key = reveal?.correctAnswer;
  return <>
    <section className="ios-series-question-card" aria-label={`Question ${q.questionIndex + 1}`}>
      <div className="battle-question-instruction">
        <span>{type === 'msq' ? 'Choose all correct answers' : type === 'nat' ? 'Enter a numeric answer' : 'Choose one answer'}</span>
        {remaining !== null && remaining <= 120 && <span role="timer" aria-label={`${remaining} seconds remaining`}>{remaining}s</span>}
      </div>
      <div className="ios-series-prompt"><RichContent text={q.question} criticalImages /></div>
      {q.questionImage && !q.question.includes(q.questionImage) && <QuestionImage src={q.questionImage} alt="Question diagram" critical />}
      {type === 'msq' && <p className="battle-helper">{q.partialCredit ? 'Partial credit for correct subsets. Any wrong choice scores zero.' : 'Select every correct option. No partial credit.'}</p>}
    </section>
    {type === 'nat' ? <form className="battle-numeric-answer" onSubmit={event => {
      event.preventDefault(); if (!locked && validNumber) onSubmit({ type: 'nat', numericAnswer: Number(numeric) });
    }}>
      <label htmlFor="battle-numeric">Your answer</label>
      <input id="battle-numeric" aria-label="Your numeric answer" type="text" inputMode="decimal" autoComplete="off" maxLength={64} disabled={locked}
        value={current?.type === 'nat' ? String(current.numericAnswer) : numeric} onChange={event => setNumeric(event.target.value)} placeholder="e.g. −2.5" />
      {reveal && key?.type === 'nat' && <p>Accepted answer: {key.min === key.max ? key.min : `${key.min} to ${key.max}`}</p>}
      {opponent?.type === 'nat' && <p>Opponent: {opponent.numericAnswer}</p>}
      {!reveal && <button data-ui-button="primary" className="battle-primary-button" type="submit" disabled={locked || !validNumber}>Lock answer</button>}
    </form> : <section className="ios-series-options" aria-label="Answer options">
      {q.options.map((option, index) => {
        const selected = battlePicked(current || draft, index);
        const correct = reveal ? key ? battleKeyIncludes(key, index) : reveal.correctIndex === index : false;
        const wrong = Boolean(reveal && selected && !correct);
        const opponentPicked = opponent ? battlePicked(opponent, index) : opponentId ? reveal?.selections[opponentId] === index : false;
        return <button key={index} data-ui-button="state" type="button" aria-pressed={selected}
          className={`ios-series-option ${selected ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''} ${reveal && selected ? 'is-user-answer' : ''} ${reveal && !correct && !wrong ? 'is-dimmed' : ''}`}
          disabled={locked} onClick={() => type === 'mcq' ? onSubmit({ type: 'mcq', selectedIndex: index })
            : setIndices(previous => previous.includes(index) ? previous.filter(value => value !== index) : [...previous, index])}>
          <span className="ios-series-option-letter">{String.fromCharCode(65 + index)}</span>
          <span className="ios-series-option-value"><RichContent text={option} />
            {q.optionImages?.[index] && !option.includes(q.optionImages[index]!) && <QuestionImage src={q.optionImages[index]!} alt={`Option ${String.fromCharCode(65 + index)} diagram`} />}</span>
          <span className="ios-series-option-status battle-option-status">
            {reveal && selected && <span className="ios-series-your-answer">Your answer</span>}
            {opponentPicked && <span className="battle-opponent-pick">Opponent</span>}
            <span className={`ios-series-option-radio ${selected ? 'is-selected' : ''}`} aria-hidden="true" />
          </span>
        </button>;
      })}
      {type === 'msq' && !reveal && <button data-ui-button="primary" type="button" className="battle-primary-button" disabled={locked || !indices.length}
        onClick={() => onSubmit(draft)}>Lock answer</button>}
    </section>}
  </>;
}

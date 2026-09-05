'use client';
import StudyModeTermsQuizEngine from '../../../_shared/StudyModeTermsQuizEngine';
import type { StudyModeTermCard } from '../../../_shared/useStudyModeTerms';

const DEMO_CARDS: StudyModeTermCard[] = [
  {
    id: "demo",
    prompt:
      'A room, group of rooms, or building in which someone may live or stay.\n\nMemory hook: Two Cs and two Ms.',
    answer: "Accommodation",
    definitionTranslation: "বাসস্থান বা থাকার জায়গা",
    answerTranslation: "বাসস্থান",
    label: "General",
  },
  {
    id: "demo-embarrass",
    prompt:
      'Cause (someone) to feel awkward, self-conscious, or ashamed.\n\nMemory hook: Two Rs and two Ss.',
    answer: "Embarrass",
    definitionTranslation: "লজ্জিত করা বা অস্বস্তিতে ফেলা",
    answerTranslation: "লজ্জিত করা",
    label: "Verb",
  },
];

export default function SpellingStudyEngine() {
  return (
    <StudyModeTermsQuizEngine
      config={{
        topic: 'spelling-misspelled-words',
        storagePrefix: 'spell',
        demoCards: DEMO_CARDS,
        title: 'Spelling & Misspelled Words',
      }}
    />
  );
}

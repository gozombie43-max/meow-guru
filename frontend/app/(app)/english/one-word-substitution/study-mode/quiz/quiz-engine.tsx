'use client';
import StudyModeTermsQuizEngine from '../../../_shared/StudyModeTermsQuizEngine';
import type { StudyModeTermCard } from '../../../_shared/useStudyModeTerms';

const DEMO_CARDS: StudyModeTermCard[] = [
  {
    id: "demo",
    prompt:
      'An inscription on a tombstone in memory of the person who has died.\n\nMemory hook: "Epi-" (upon) + "taph" (tomb) - literally, words written upon a tomb.',
    answer: "Epitaph",
    definitionTranslation: "সমাধিফলকে মৃত ব্যক্তির স্মরণে লেখা অনুশোচনা বা প্রশস্তি",
    answerTranslation: "সমাধি-লেখ, স্মৃতি-লেখ",
    label: "Study of",
  },
  {
    id: "demo-bibliophile",
    prompt:
      'A person who loves and collects books.\n\nMemory hook: "Biblio-" (book) + "-phile" (lover) - same root as bibliography.',
    answer: "Bibliophile",
    definitionTranslation: "যে ব্যক্তি বই ভালোবাসে এবং সংগ্রহ করে",
    answerTranslation: "গ্রন্থপ্রেমী, বইপ্রেমী",
    label: "People",
  },
];

export default function OneWordSubstitutionStudyEngine() {
  return (
    <StudyModeTermsQuizEngine
      config={{
        topic: 'one-word-substitution',
        storagePrefix: 'ows',
        demoCards: DEMO_CARDS,
        title: 'One Word Substitution',
      }}
    />
  );
}

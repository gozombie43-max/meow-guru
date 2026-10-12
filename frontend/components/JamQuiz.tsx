"use client";
import QuizEngine from '@/features/quiz/components/QuizEngine';
import { JAM_SECTIONS, JAM_SUBJECT, jamSectionHref, jamQuestionTopic } from '@/lib/exam-mode';
import type { SubjectConfig } from '@/features/quiz/model/types';
const config: SubjectConfig = {
  subjectId: JAM_SUBJECT, subjectLabel: 'IIT JAM Physics', cssClassName: 'physics-quiz',
  topicConcepts: Object.fromEntries(JAM_SECTIONS.map(s => [jamQuestionTopic(s.slug), [...s.topics]])),
  modeLabels: { formula: 'Formula practice', mixed: 'Mixed practice', 'ai-challenge': 'Speed practice', hard: 'Advanced practice' },
  formulaModeLabel: 'Formula practice', classificationCategories: [], getClassificationCategoryId: () => 'all',
};
export default function JamQuiz({ slug }: { slug: string }) {
  const section = JAM_SECTIONS.find(s => s.slug === slug)!;
  return <QuizEngine subjectConfig={config} title={section.title} slug={jamQuestionTopic(slug)} routeBase={jamSectionHref(slug)} />;
}

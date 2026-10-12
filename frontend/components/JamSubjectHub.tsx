"use client";
import { useTopicQuestionTotals } from '@/hooks/useTopicQuestionTotals';
import SubjectHub from '@/components/subject-hub/SubjectHub';
import type { SubjectHubConfig } from '@/components/subject-hub/types';
import { Atom } from 'lucide-react';
import { JAM_SECTIONS, JAM_SUBJECT, jamSectionHref, jamQuestionTopic } from '@/lib/exam-mode';
const config: SubjectHubConfig = {
  subjectId: JAM_SUBJECT, label: 'IIT JAM Physics', icon: Atom, mobileAppearance: 'oled',
  topics: JAM_SECTIONS.map((s, i) => ({ id: i + 1, name: s.title, slug: s.slug, questionTopic: jamQuestionTopic(s.slug), routeBase: jamSectionHref(s.slug), subtopics: [...s.topics], priority: 'All', questions: '', icon: Atom, color: s.color, description: s.topics.join(' · '), expectedMarks: '' })),
  categories: [{ id: 'All', label: 'Physics', icon: Atom }], priorityConfig: { All: { label: 'Physics', badgeBg: 'transparent', badgeColor: 'var(--ios-system-blue)' } }, practiceModes: ['concept', 'formula', 'mixed', 'hard'].map(mode => ({ key: mode, title: ({ concept: 'Concept practice', formula: 'Formula practice', mixed: 'Mixed practice', hard: 'Advanced practice' } as Record<string, string>)[mode], sub: 'Physics questions', mode, icon: Atom, color: 'var(--ios-system-blue)', gradient: 'var(--surface)', gradientDark: 'var(--surface)', border: 'var(--border)', borderDark: 'var(--border)', shadow: 'none' })), initialCategory: 'All', notesHref: '/resource',
  notesLabel: 'Physics notes', searchPlaceholder: 'Search Physics sections...', mobileSearchPlaceholder: 'Search Physics sections...',
};
export default function JamSubjectHub() {
  const { data } = useTopicQuestionTotals(JAM_SUBJECT);
  const mobileTopicDetails = Object.fromEntries(JAM_SECTIONS.map(s => [s.slug, { color: s.color, questionCount: data?.totals?.[jamQuestionTopic(s.slug)] ?? 0, userSolved: data?.userProgress?.[jamQuestionTopic(s.slug)]?.userSolved ?? 0 }]));
  return <SubjectHub config={{ ...config, topics: config.topics.map(t => ({ ...t, questions: String(data?.totals?.[t.questionTopic!] ?? 0) })), mobileTopicDetails }} />;
}

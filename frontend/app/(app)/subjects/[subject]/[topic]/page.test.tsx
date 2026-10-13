import { describe, expect, it, vi } from 'vitest';
import { JAM_SECTIONS, JAM_SUBJECT, jamSectionHref } from '@/lib/exam-mode';
import { getJamChapterGroup } from '@/lib/jam-chapters';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));
vi.mock('@/app/(app)/general-awareness/_shared/ranked-topic-group-page', () => ({ default: () => null }));
vi.mock('@/features/quiz/components/SubjectTopicPage', () => ({ default: () => null }));

import Page from './page';
import ChapterPage from './[chapter]/page';
import RankedTopicGroupPage from '@/app/(app)/general-awareness/_shared/ranked-topic-group-page';

describe('IIT JAM section chapter navigation', () => {
  it.each(JAM_SECTIONS)('$title opens its chapter list and every chapter resolves', async section => {
    const page = await Page({ params: Promise.resolve({ subject: JAM_SUBJECT, topic: section.slug }) });
    expect(page.type).toBe(RankedTopicGroupPage);
    expect(page.props.subject).toBe(JAM_SUBJECT);
    expect(page.props.routeBase).toBe(jamSectionHref(section.slug));
    const group = getJamChapterGroup(section.slug)!;
    expect(page.props.group).toEqual(group);
    expect(group.topics.length).toBeGreaterThan(0);
    for (const chapter of group.topics) {
      const target = await ChapterPage({ params: Promise.resolve({ subject: JAM_SUBJECT, topic: section.slug, chapter: chapter.slug }) });
      expect(target.props.title).toBe(chapter.title);
      expect(target.props.routeBase).toBe(`${page.props.routeBase}/${chapter.slug}`);
      expect(target.props.backHref).toBe(page.props.routeBase);
    }
  });

  it.each([
    { subject: 'mathematics', topic: 'mechanics' },
    { subject: JAM_SUBJECT, topic: 'unknown-section' },
  ])('rejects invalid section routes: $subject/$topic', async params => {
    await expect(Page({ params: Promise.resolve(params) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

import EnglishIcon from '@/components/EnglishIcon';
import GkIcon from '@/components/GkIcon';
import MathIcon from '@/components/MathIcon';
import ReasoningIcon from '@/components/ReasoningIcon';

export const mobileSubjects = [
  { title: 'MATH', href: '/mathematics', icon: MathIcon, tone: 'math' },
  { title: 'REASONING', href: '/reasoning', icon: ReasoningIcon, tone: 'reasoning' },
  { title: 'ENGLISH', href: '/english', icon: EnglishIcon, tone: 'english' },
  { title: 'GK', href: '/general-awareness', icon: GkIcon, tone: 'gk' },
] as const;

const mobileSubjectLookup = {
  mathematics: mobileSubjects[0],
  math: mobileSubjects[0],
  reasoning: mobileSubjects[1],
  english: mobileSubjects[2],
  'general-awareness': mobileSubjects[3],
  'general awareness': mobileSubjects[3],
  gk: mobileSubjects[3],
} as const;

/** Resolve the mobile subject icon and tone used by both subject pills and recent quiz cards. */
export function getMobileSubjectVisual(subject: string, pathname = '') {
  const key = subject.trim().toLowerCase();
  if (key in mobileSubjectLookup) {
    return mobileSubjectLookup[key as keyof typeof mobileSubjectLookup];
  }
  return mobileSubjects.find((item) => pathname.startsWith(item.href)) ?? null;
}

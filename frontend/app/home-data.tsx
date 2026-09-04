import MathIcon from '@/components/MathIcon';
import ReasoningIcon from '@/components/ReasoningIcon';
import EnglishIcon from '@/components/EnglishIcon';
import GkIcon from '@/components/GkIcon';
import {
  MathSubjectIcon,
  ReasoningSubjectIcon,
  EnglishSubjectIcon,
  GkSubjectIcon,
} from '@/components/SubjectIconBadges';

export const HERO_BLUR_DATA_URL =
  'data:image/webp;base64,UklGRlIBAABXRUJQVlA4WAoAAAAQAAAADwAAFwAAQUxQSJ8AAAABgJpt27Ll/Q1LLs2jL+CJRnIaA2h1h+busoMmaOzg0N3tucL7Pi8yQURMgPmvCR0FAa+qa7gYT1LitwW4qTNqxsAOMGU8q0uA5ziPzjFE3rM81o8Ruc3VUpYFYDSsHOE+DDrivxXyHA3oHY5FjwPHsiUCPEesFfFMtxoFQICTgBVYtIDHcuOsUVqMu1jJUZrEXakMKx3KitKrzCrNxhgAVlA4IIwAAAAQBACdASoQABgAPzmEuVOvKKWisAgB4CcJbACxC8ADABGzs/BgoAfDdgD+4vReDlteFEu1w9rLyTMY6OJIRGfKH6FpF1WJyhVFRPlJXxtbtAKuqG/AHpZhXt18I/bIE3o/0H7sQIEJgc7ugZqvm66wQjtDjhTkV+TgfoQKNjqUbrTZKeyzSawe7AAAAA==';

export const desktopSubjects = [
  { title: 'MATH', subtitle: 'Practice & master mathematics', href: '/mathematics', Icon: MathSubjectIcon },
  { title: 'REASONING', subtitle: 'Sharpen your logical reasoning', href: '/reasoning', Icon: ReasoningSubjectIcon },
  { title: 'ENGLISH', subtitle: 'Improve grammar & vocabulary', href: '/english', Icon: EnglishSubjectIcon },
  { title: 'GK', subtitle: 'Stay updated with general knowledge', href: '/general-awareness', Icon: GkSubjectIcon },
] as const;

export const mobileSubjects = [
  { title: 'MATH', href: '/mathematics', icon: MathIcon, tone: 'math' },
  { title: 'REASONING', href: '/reasoning', icon: ReasoningIcon, tone: 'reasoning' },
  { title: 'ENGLISH', href: '/english', icon: EnglishIcon, tone: 'english' },
  { title: 'GK', href: '/general-awareness', icon: GkIcon, tone: 'gk' },
] as const;

export const recentQuizzesData = [
  { tag: 'ENGLISH', tagTone: 'english', title: 'Synonyms & Antonyms', subtitle: 'Continue from Q17', progress: '17/970', progressPercent: 18, href: '/english' },
  { tag: 'REASONING', tagTone: 'reasoning', title: 'Coding – Decoding', subtitle: 'Continue from Q23', progress: '23/850', progressPercent: 24, href: '/reasoning' },
  { tag: 'GK', tagTone: 'gk', title: 'Indian Polity', subtitle: 'Continue from Q12', progress: '12/680', progressPercent: 14, href: '/general-awareness' },
  { tag: 'MATH', tagTone: 'math', title: 'Percentages & Fractions', subtitle: 'Continue from Q31', progress: '31/520', progressPercent: 35, href: '/mathematics' },
  { tag: 'ENGLISH', tagTone: 'english', title: 'One Word Substitution', subtitle: 'Continue from Q45', progress: '45/780', progressPercent: 42, href: '/english' },
  { tag: 'REASONING', tagTone: 'reasoning', title: 'Syllogism & Inferences', subtitle: 'Continue from Q8', progress: '8/410', progressPercent: 19, href: '/reasoning' },
  { tag: 'GK', tagTone: 'gk', title: 'Modern Indian History', subtitle: 'Continue from Q19', progress: '19/640', progressPercent: 28, href: '/general-awareness' },
  { tag: 'MATH', tagTone: 'math', title: 'Profit & Loss', subtitle: 'Continue from Q14', progress: '14/490', progressPercent: 22, href: '/mathematics' },
  { tag: 'ENGLISH', tagTone: 'english', title: 'Idioms & Phrases', subtitle: 'Continue from Q36', progress: '36/890', progressPercent: 38, href: '/english' },
  { tag: 'REASONING', tagTone: 'reasoning', title: 'Blood Relations', subtitle: 'Continue from Q27', progress: '27/360', progressPercent: 52, href: '/reasoning' },
] as const;

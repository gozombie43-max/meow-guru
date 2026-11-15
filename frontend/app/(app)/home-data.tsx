import EnglishIcon from '@/components/EnglishIcon';
import GkIcon from '@/components/GkIcon';
import MathIcon from '@/components/MathIcon';
import ReasoningIcon from '@/components/ReasoningIcon';

export const HERO_BLUR_DATA_URL =
  'data:image/webp;base64,UklGRlIBAABXRUJQVlA4WAoAAAAQAAAADwAAFwAAQUxQSJ8AAAABgJpt27Ll/Q1LLs2jL+CJRnIaA2h1h+busoMmaOzg0N3tucL7Pi8yQURMgPmvCR0FAa+qa7gYT1LitwW4qTNqxsAOMGU8q0uA5ziPzjFE3rM81o8Ruc3VUpYFYDSsHOE+DDrivxXyHA3oHY5FjwPHsiUCPEesFfFMtxoFQICTgBVYtIDHcuOsUVqMu1jJUZrEXakMKx3KitKrzCrNxhgAVlA4IIwAAAAQBACdASoQABgAPzmEuVOvKKWisAgB4CcJbACxC8ADABGzs/BgoAfDdgD+4vReDlteFEu1w9rLyTMY6OJIRGfKH6FpF1WJyhVFRPlJXxtbtAKuqG/AHpZhXt18I/bIE3o/0H7sQIEJgc7ugZqvm66wQjtDjhTkV+TgfoQKNjqUbrTZKeyzSawe7AAAAA==';

export const mobileSubjects = [
  { title: 'MATH', href: '/mathematics', icon: MathIcon, tone: 'math' },
  { title: 'REASONING', href: '/reasoning', icon: ReasoningIcon, tone: 'reasoning' },
  { title: 'ENGLISH', href: '/english', icon: EnglishIcon, tone: 'english' },
  { title: 'GK', href: '/general-awareness', icon: GkIcon, tone: 'gk' },
] as const;

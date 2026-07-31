import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Access Code — StudyGuru',
  description: 'Enter your invite code to access StudyGuru',
};

/**
 * Minimal layout for the access-code page.
 * Strips out BottomNav and page transitions for a clean full-screen experience.
 */
export default function AccessCodeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

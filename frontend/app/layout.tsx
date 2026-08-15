import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import './adaptive-quiz/adaptive-quiz.css';
import { AuthProvider } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';
import AppWarmup from '@/components/AppWarmup';
import AppRecovery from '@/components/AppRecovery';
import FeedbackToast from '@/components/FeedbackToast';
import PageTransitionShell from '@/components/PageTransitionShell';
import StudyTimeTracker from '@/components/StudyTimeTracker';

import InitialLoadingGate from '@/components/InitialLoadingGate';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Meow — SSC Exam Prep',
  description: 'SSC CGL & CHSL Previous Year Questions',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (sessionStorage.getItem('app-initial-boot-complete') !== '1') {
                    document.documentElement.classList.add('app-is-booting');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={geist.className}>
        <AuthProvider>
          <InitialLoadingGate />
          <StudyTimeTracker />
          <AppRecovery />
          <AppWarmup />
          <PageTransitionShell>{children}</PageTransitionShell>
          <BottomNav />
          <FeedbackToast />
        </AuthProvider>
      </body>
    </html>
  );
}

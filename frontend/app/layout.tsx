import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';
import AppWarmup from '@/components/AppWarmup';
import AppRecovery from '@/components/AppRecovery';
import FeedbackToast from '@/components/FeedbackToast';
import PageTransitionShell from '@/components/PageTransitionShell';
import StudyTimeTracker from '@/components/StudyTimeTracker';

const geist = Geist({ subsets: ['latin'] });

const themeBootstrapScript = `
  (() => {
    const themeKey = 'ui-theme';
    const themeClasses = ['theme-light', 'theme-dark'];

    try {
      const savedTheme = window.localStorage.getItem(themeKey);
      const theme = savedTheme === 'light' || savedTheme === 'dark'
        ? savedTheme
        : window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';

      const applyTheme = (element) => {
        element.classList.remove(...themeClasses);
        element.classList.add('theme-' + theme);
        element.dataset.theme = theme;
        element.style.colorScheme = theme;
      };

      applyTheme(document.documentElement);

      if (document.body) {
        applyTheme(document.body);
      } else {
        const observer = new MutationObserver(() => {
          if (!document.body) return;
          applyTheme(document.body);
          observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true });
      }
    } catch {
      document.documentElement.classList.add('theme-light');
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
    }
  })();
`;

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
          id="theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className={geist.className} suppressHydrationWarning>
        <AuthProvider>
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

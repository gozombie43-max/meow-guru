import type { Metadata,Viewport } from 'next';
import localFont from 'next/font/local';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';
import './light-theme.css';
import './dark-theme.css';
import './interface.css';

// Most study/auth surfaces use the system font stack. Only fetch Geist where
// it is actually used instead of preloading it ahead of every route's content.
const GeistSans = localFont({
  src: '../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  preload: false,
});

const themeBootstrapScript = `
  (() => {
    const themeKey = 'ui-theme';
    const themeClasses = ['theme-light', 'theme-dark'];

    try {
      const savedTheme = window.localStorage.getItem(themeKey);
      const theme = savedTheme === 'light' || savedTheme === 'dark'
        ? savedTheme
        : 'dark';

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
      document.documentElement.classList.add('theme-dark');
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.style.colorScheme = 'dark';
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
      <body className={GeistSans.variable} suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

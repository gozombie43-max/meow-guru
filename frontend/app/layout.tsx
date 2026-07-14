import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';
import AppWarmup from '@/components/AppWarmup';
import AppRecovery from '@/components/AppRecovery';
import FeedbackToast from '@/components/FeedbackToast';

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
    <html lang="en">
      <body className={geist.className}>
        <AuthProvider>
          <AppRecovery />
          <AppWarmup />
          {children}
          <BottomNav />
          <FeedbackToast />
        </AuthProvider>
      </body>
    </html>
  );
}

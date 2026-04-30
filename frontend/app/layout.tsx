import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import BottomNav from '@/components/BottomNav';
import AppWarmup from '@/components/AppWarmup';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Meow — SSC Exam Prep',
  description: 'SSC CGL & CHSL Previous Year Questions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <AuthProvider>
          <AppWarmup />
          {children}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}

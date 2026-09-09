import AppRecovery from '@/components/AppRecovery';
import BottomNav from '@/components/BottomNav';
import FeedbackToast from '@/components/FeedbackToast';
import PageTransitionShell from '@/components/PageTransitionShell';
import { AuthProvider } from '@/context/AuthContext';

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppRecovery />
      <PageTransitionShell>{children}</PageTransitionShell>
      <BottomNav />
      <FeedbackToast />
    </AuthProvider>
  );
}

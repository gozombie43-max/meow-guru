import AppRecovery from '@/components/AppRecovery';
import BottomNav from '@/components/BottomNav';
import FeedbackToast from '@/components/FeedbackToast';
import QuizExitDialog from '@/components/QuizExitDialog';
import PageTransitionShell from '@/components/PageTransitionShell';
import ApplicationProviders from '@/app/providers';
import { StudentPresenceProvider } from '@/context/StudentPresenceContext';

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationProviders>
      <StudentPresenceProvider>
        <AppRecovery />
        <PageTransitionShell>{children}</PageTransitionShell>
        <BottomNav />
        <FeedbackToast />
        <QuizExitDialog />
      </StudentPresenceProvider>
    </ApplicationProviders>
  );
}

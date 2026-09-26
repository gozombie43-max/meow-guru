import AppRecovery from '@/components/AppRecovery';
import BottomNav from '@/components/BottomNav';
import FeedbackToast from '@/components/FeedbackToast';
import QuizExitDialog from '@/components/QuizExitDialog';
import PageTransitionShell from '@/components/PageTransitionShell';
import ApplicationProviders from '@/app/providers';

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationProviders>
      <AppRecovery />
      <PageTransitionShell>{children}</PageTransitionShell>
      <BottomNav />
      <FeedbackToast />
      <QuizExitDialog />
    </ApplicationProviders>
  );
}

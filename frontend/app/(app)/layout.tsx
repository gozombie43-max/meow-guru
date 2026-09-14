import AppRecovery from '@/components/AppRecovery';
import BottomNav from '@/components/BottomNav';
import FeedbackToast from '@/components/FeedbackToast';
import QuizExitDialog from '@/components/QuizExitDialog';
import PageTransitionShell from '@/components/PageTransitionShell';

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppRecovery />
      <PageTransitionShell>{children}</PageTransitionShell>
      <BottomNav />
      <FeedbackToast />
      <QuizExitDialog />
    </>
  );
}

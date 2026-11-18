import AppRecovery from '@/components/AppRecovery';
import BottomNav from '@/components/BottomNav';
import FeedbackToast from '@/components/FeedbackToast';
import QuizExitDialog from '@/components/QuizExitDialog';
import PageTransitionShell from '@/components/PageTransitionShell';
import ApplicationProviders from '@/app/providers';
import AuthGate from '@/components/auth/AuthGate';

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationProviders>
      <AppRecovery />
      <PageTransitionShell><AuthGate>{children}</AuthGate></PageTransitionShell>
      <BottomNav />
      <FeedbackToast />
      <QuizExitDialog />
    </ApplicationProviders>
  );
}

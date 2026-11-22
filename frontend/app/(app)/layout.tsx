import AppRecovery from '@/components/AppRecovery';
import BottomNav from '@/components/BottomNav';
import FeedbackToast from '@/components/FeedbackToast';
import QuizExitDialog from '@/components/QuizExitDialog';
import PageTransitionShell from '@/components/PageTransitionShell';
import ApplicationProviders from '@/app/providers';
import AuthGate from '@/components/auth/AuthGate';
import { NotificationCenterProvider } from '@/context/NotificationCenterContext';

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationProviders>
      <NotificationCenterProvider>
        <AppRecovery />
        <PageTransitionShell><AuthGate>{children}</AuthGate></PageTransitionShell>
        <BottomNav />
        <FeedbackToast />
        <QuizExitDialog />
      </NotificationCenterProvider>
    </ApplicationProviders>
  );
}

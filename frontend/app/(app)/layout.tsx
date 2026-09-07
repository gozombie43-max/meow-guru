import AppRecovery from '@/components/AppRecovery';
import AppWarmup from '@/components/AppWarmup';
import BottomNav from '@/components/BottomNav';
import FeedbackToast from '@/components/FeedbackToast';
import PageTransitionShell from '@/components/PageTransitionShell';
import PushOpenAnalyticsBridge from '@/components/PushOpenAnalyticsBridge';
import PushRegistrationBridge from '@/components/PushRegistrationBridge';
import StudyTimeTracker from '@/components/StudyTimeTracker';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationCenterProvider } from "@/context/NotificationCenterContext";
import { StudyTelemetryProvider } from "@/context/StudyTelemetryContext";

export default function StudyLayout({ children }: { children: React.ReactNode }) {
 return (
        <AuthProvider>
          <PushRegistrationBridge />
          <PushOpenAnalyticsBridge />
          <NotificationCenterProvider>
            <StudyTelemetryProvider>
              <StudyTimeTracker />
              <AppRecovery />
              <AppWarmup />
              <PageTransitionShell>{children}</PageTransitionShell>
              <BottomNav />
              <FeedbackToast />
            </StudyTelemetryProvider>
          </NotificationCenterProvider>
        </AuthProvider>
 );
}

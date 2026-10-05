import QuizRouteShell from '@/features/quiz/components/QuizRouteShell';
import MathematicsQuizEngine from './quiz-engine';
import { resolveMathematicsPageProps, type MathematicsPageProps } from './route-page';
import type { MathematicsRouteGroup } from '@/lib/mathematics-topics';

export async function renderMathematicsQuizPage(props: MathematicsPageProps, group: MathematicsRouteGroup) {
  return <QuizRouteShell><MathematicsQuizEngine {...await resolveMathematicsPageProps(props, group)} /></QuizRouteShell>;
}

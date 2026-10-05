import MathematicsTopicPage from './topic-page';
import { resolveMathematicsPageProps, type MathematicsPageProps } from './route-page';
import type { MathematicsRouteGroup } from '@/lib/mathematics-topics';

export async function renderMathematicsTopicPage(props: MathematicsPageProps, group: MathematicsRouteGroup) {
  return <MathematicsTopicPage {...await resolveMathematicsPageProps(props, group)} />;
}

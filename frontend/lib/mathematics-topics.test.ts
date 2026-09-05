import { describe, expect, it } from 'vitest';
import { MATHEMATICS_TOPICS, mathematicsTopicRoute, mathematicsTopicsForRoute } from './mathematics-topics';
import { QUIZ_TREE } from './quiz-constants';
describe('canonical Mathematics routes', () => {
  it('keeps every canonical route and legacy alias reachable through static params', () => {
    const routes = new Set<string>();
    for (const group of ['top-level', 'advance', 'arithmetic'] as const) {
      for (const slug of mathematicsTopicsForRoute(group)) {
        routes.add(`/mathematics/${group === 'top-level' ? '' : `${group}/`}${slug}`);
      }
    }
    for (const topic of Object.values(MATHEMATICS_TOPICS)) {
      expect(mathematicsTopicRoute(topic.slug)).toBe(topic.route);
      expect(QUIZ_TREE.mathematics.topics[topic.slug].label).toBe(topic.label);
      for (const route of [topic.route, ...topic.aliases]) expect(routes.has(route)).toBe(true);
    }
  });
  it('retains the arithmetic Number System alias and specialized mensuration modes', () => {
    expect(mathematicsTopicsForRoute('arithmetic')).toContain('number-system');
    expect(mathematicsTopicRoute('algebra')).toBe('/mathematics/advance/algebra');
    expect(QUIZ_TREE.mathematics.topics.mensuration.quizzes).not.toContain('PW');
  });
});

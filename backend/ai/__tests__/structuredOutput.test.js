import { expect, it } from 'vitest';
import { questionDraftsSchema, failureClassificationSchema, conceptGroupsSchema } from '@meow/contracts/ai';
import { geometryDiagramSchema } from '@meow/contracts/geometry';

it('rejects valid JSON with invalid diagram structure and unsafe dimensions', () => {
  for (const input of [{ shapes: [{ type: 'unknown' }] }, { shapes: [] }, { width: 1e9, shapes: [{ type: 'circle', center: { x: 0, y: 0 }, radius: 1 }] }]) {
    expect(geometryDiagramSchema.safeParse(input).success).toBe(false);
  }
  expect(geometryDiagramSchema.parse({ shapes: [{ type: 'circle', center: { x: 0, y: 0 }, radius: 2 }] }).shapes).toHaveLength(1);
});
it('rejects invented classification dimensions, malformed question answers and group IDs', () => {
  expect(failureClassificationSchema.safeParse({ dimension: 'OTHER', confidence: 2, reason: 'x' }).success).toBe(false);
  expect(questionDraftsSchema.safeParse([{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctAnswer: 4, explanation: 'x', topic: 'x', difficulty: 'easy' }]).success).toBe(false);
  expect(conceptGroupsSchema.safeParse({ groups: [{ label: 'x', description: 'x', conceptIds: [-1] }] }).success).toBe(false);
});

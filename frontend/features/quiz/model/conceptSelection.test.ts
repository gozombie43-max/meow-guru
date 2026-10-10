import { expect, it } from 'vitest';
import { parseConceptSelection, serializeConceptSelection } from './conceptSelection';

it('restores old selections and preserves concept punctuation when saving a session', () => {
  expect(parseConceptSelection('alligation,rate')).toEqual(['alligation', 'rate']);
  const concepts = ['principal, rate and time', 'alligation'];
  expect(parseConceptSelection(serializeConceptSelection(concepts))).toEqual(concepts);
  expect(parseConceptSelection(serializeConceptSelection(['[rate] comparisons']))).toEqual(['[rate] comparisons']);
  expect(parseConceptSelection('[invalid')).toEqual([]);
});

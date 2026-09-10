import { describe, expect, it } from 'vitest';

import {
  type StudyModeComparisonConfig,
  toStudyModeCard,
} from './study-mode-comparison-model';

const config: StudyModeComparisonConfig = {
  topic: 'synonyms-antonyms',
  primaryField: 'synonyms',
  secondaryField: 'antonyms',
  primaryLabel: 'Synonyms',
  secondaryLabel: 'Antonyms',
  primaryTitle: 'Similar words',
  secondaryTitle: 'Opposite words',
  primaryEmptyLabel: 'No synonyms',
  secondaryEmptyLabel: 'No antonyms',
  demoCard: {
    id: 'demo',
    word: 'Demo',
    meanings: [],
    primaryItems: [],
    secondaryItems: [],
  },
};

describe('study mode comparison model', () => {
  it('normalizes API entries without leaking malformed values to the view', () => {
    expect(
      toStudyModeCard(
        {
          id: '42',
          word: '  Bright  ',
          meanings: [
            { pos: ' adjective ', definition: ' full of light ', translation: ' उज्ज्वल ' },
            { definition: '   ' },
          ],
          synonyms: [{ word: ' Shining ', translation: ' चमकदार ' }, { word: '' }],
          antonyms: 'not-an-array',
        },
        0,
        config
      )
    ).toEqual({
      id: '42',
      word: 'Bright',
      meanings: [{ pos: 'adjective', definition: 'full of light', translation: 'उज्ज्वल' }],
      primaryItems: [{ word: 'Shining', translation: 'चमकदार' }],
      secondaryItems: [],
    });
  });

  it('drops entries without a word', () => {
    expect(toStudyModeCard({ word: '   ' }, 0, config)).toBeNull();
  });
});

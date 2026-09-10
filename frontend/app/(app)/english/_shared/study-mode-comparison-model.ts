export type StudyModeMeaning = {
  pos?: string;
  definition?: string;
  translation?: string;
};

export type StudyModeEntry = {
  id?: string;
  word?: string;
  meanings?: StudyModeMeaning[];
  [key: string]: unknown;
};

export type StudyModeCard = {
  id: string;
  word: string;
  meanings: StudyModeMeaning[];
  primaryItems: StudyModeComparisonItem[];
  secondaryItems: StudyModeComparisonItem[];
};

export type StudyModeComparisonItem = {
  word: string;
  translation?: string;
};

export type StudyModeComparisonConfig = {
  topic: string;
  primaryField: string;
  secondaryField: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryTitle: string;
  secondaryTitle: string;
  primaryEmptyLabel: string;
  secondaryEmptyLabel: string;
  demoCard: StudyModeCard;
};

function normalizeItems(value: unknown): StudyModeComparisonItem[] {
  if (!Array.isArray(value)) return [];
  return value.reduce((items, item) => {
      if (typeof item !== 'object' || item === null) return items;
      const record = item;
      const word = String(record.word ?? '').trim();
      if (!word) return items;
      const translation =
        typeof record.translation === 'string' ? record.translation.trim() : undefined;
      items.push({ word, translation });
      return items;
    }, []);
}
export function toStudyModeCard(
  entry: StudyModeEntry,
  index: number,
  config: StudyModeComparisonConfig
): StudyModeCard | null {
  const word = String(entry.word ?? '').trim();
  if (!word) return null;

  const meanings = Array.isArray(entry.meanings)
    ? entry.meanings
        .map((meaning) => ({
          pos: meaning?.pos?.trim(),
          definition: meaning?.definition?.trim(),
          translation: meaning?.translation?.trim(),
        }))
        .filter((meaning) => Boolean(meaning.definition))
    : [];

  return {
    id: String(entry.id ?? index + 1),
    word,
    meanings,
    primaryItems: normalizeItems(entry[config.primaryField]),
    secondaryItems: normalizeItems(entry[config.secondaryField]),
  };
}

// Keep old saved sessions readable, while preserving commas inside concept labels.
export function serializeConceptSelection(concepts: string[]): string {
  return concepts.some(concept => concept.includes(',') || concept.startsWith('[')) ? JSON.stringify(concepts) : concepts.join(',');
}

export function parseConceptSelection(value?: string): string[] {
  if (!value) return [];
  if (!value.startsWith('[')) return value.split(',').filter(Boolean);
  try {
    const concepts: unknown = JSON.parse(value);
    return Array.isArray(concepts) && concepts.every(concept => typeof concept === 'string') ? concepts : [];
  } catch { return []; }
}

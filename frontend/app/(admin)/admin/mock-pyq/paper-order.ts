export type DatedPaper = {
  id: string; title: string; examDate?: string | null; year?: number | null;
  shift?: string | number | null; order?: number;
};
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function dateParts(paper: DatedPaper) {
  const saved = paper.examDate?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  const legacy = (text: string) => text.match(/\b([0-3]?\d)[\s./-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*(?:[\s,./-]+((?:19|20)\d{2}))?\b/i);
  const match = legacy(paper.title) || legacy(paper.id);
  const year = saved ? Number(saved[1]) : Number(match?.[3] || paper.year || `${paper.title} ${paper.id}`.match(/\b((?:19|20)\d{2})\b/)?.[1]) || 0;
  const month = saved ? Number(saved[2]) - 1 : match ? months.indexOf(match[2].toUpperCase()) : -1;
  const day = saved ? Number(saved[3]) : Number(match?.[1]);
  const date = new Date(Date.UTC(year, month, day));
  const valid = year >= 1000 && year <= 2999 && month >= 0 && month <= 11 && day > 0
    && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day;
  return { year, day: valid ? (month + 1) * 100 + day : 9999, date: valid ? date : null };
}

function shiftNumber(paper: DatedPaper) {
  const stored = String(paper.shift ?? '').trim();
  const explicit = stored.match(/^(?:SHIFT\s*[-:]?\s*)?(\d+)\b/i);
  const fallback = `${paper.title} ${paper.id}`.match(/SHIFT[\s_-]*[-:]?\s*(\d+)\b/i);
  return Number(explicit?.[1] || fallback?.[1]) || 9999;
}

/** Latest year first, then calendar date and numeric shift; undated papers last in their year. */
export function comparePaperDateAndShift(a: DatedPaper, b: DatedPaper) {
  const left = dateParts(a);
  const right = dateParts(b);
  return right.year - left.year || left.day - right.day || shiftNumber(a) - shiftNumber(b)
    || (a.order ?? 1) - (b.order ?? 1) || a.id.localeCompare(b.id, 'en', { numeric: true });
}

export function paperDateLabel(paper: DatedPaper) {
  const { date, year } = dateParts(paper);
  return date ? dateFormat.format(date) : year ? String(year) : '—';
}

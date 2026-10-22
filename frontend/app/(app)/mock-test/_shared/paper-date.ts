import type { MockTestSlot } from './exam-config';

const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Published dates take priority; older uploads may only carry a date in their title. */
export function paperDate(slot: MockTestSlot) {
  const saved = slot.examDate || slot.paperMetadata?.examDate;
  const iso = saved?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  const title = slot.title.match(/\b([0-3]?\d)[\s./-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*(?:[\s,./-]+((?:19|20)\d{2}))?\b/i);
  const year = iso ? Number(iso[1]) : Number(title?.[3] || slot.year || slot.title.match(/\b((?:19|20)\d{2})\b/)?.[1]);
  const month = iso ? Number(iso[2]) - 1 : title ? months.indexOf(title[2].toUpperCase()) : -1;
  const day = iso ? Number(iso[3]) : Number(title?.[1]);
  if (!year || month < 0 || month > 11 || !day) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return { year, month: months[month], day, iso: date.toISOString().slice(0, 10) };
}

/** Keep result and review subtitles consistent with the published paper metadata. */
export function paperDisplayTitle(slot: MockTestSlot): string {
  const date = paperDate(slot);
  const titleDate = paperDate({ ...slot, examDate: undefined, paperMetadata: undefined });
  if (!date || titleDate?.iso === date.iso) return slot.title;
  return slot.title.includes(String(date.year))
    ? slot.title.replace(String(date.year), `${date.year} ${date.day} ${date.month}`)
    : `${slot.title} · ${date.day} ${date.month} ${date.year}`;
}

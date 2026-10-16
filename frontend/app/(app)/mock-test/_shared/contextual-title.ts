/** Remove only leading context already visible in the exam header. */
export function contextualTitle(title: string, examName: string, tier: string): string {
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const strip = (text: string, prefix: string) => prefix
    ? text.replace(new RegExp(`^${escape(prefix)}(?=\\s|[—–:|\\-]|$)[\\s—–:|\\-]*`, 'i'), '')
    : text;
  const withoutExam = strip(title.trim(), examName);
  return strip(withoutExam, tier).trim() || title;
}

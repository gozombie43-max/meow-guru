// All sectional clocks are derived from server timestamps, never client timer values.
export function sectionTiming(attempt, now = Date.now(), advance = false) {
  if (!attempt.paper?.schemaDriven || attempt.paper.compositeTimer) return null;
  const sections = attempt.paper.sections;
  const remaining = Object.fromEntries(sections.map(section => [section.key,
    attempt.sectionRemainingTimes?.[section.key] ?? (section.timeLimitMin > 0 ? section.timeLimitMin * 60 : null)]));
  let index = attempt.timerSection ?? 0;
  let started = new Date(attempt.sectionStartedAt || attempt.startedAt).getTime();
  let elapsed = Math.max(0, (now - started) / 1000);
  let exhausted = false;
  while (index < sections.length) {
    const key = sections[index].key;
    const time = remaining[key];
    if (time === null || elapsed < time) {
      if (time !== null) remaining[key] = Math.max(0, time - elapsed);
      break;
    }
    remaining[key] = 0;
    elapsed -= time;
    started += time * 1000;
    if (index === sections.length - 1) { exhausted = true; break; }
    index++;
  }
  // A late expiry save must not also skip the section the server just activated.
  if (advance && !exhausted && index === (attempt.timerSection ?? 0)) {
    remaining[sections[index].key] = 0;
    if (index < sections.length - 1) index++;
    else exhausted = true;
  }
  return {
    timerSection: index, currentSection: index,
    sectionRemainingTimes: remaining, sectionStartedAt: new Date(now).toISOString(),
    sectionsExhausted: exhausted,
    lockedSections: sections.filter((_, i) => i < index || exhausted).map(section => section.key),
  };
}

/** Fullscreen tools own their navigation and safe-area clearance. */
export function hidesPrimaryNavigation(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  const within = (root: string) => path === root || path.startsWith(`${root}/`);
  if (path.split("/").includes("quiz")) return true;
  if (["/play/session", "/play/setup", "/notes/view", "/resource", "/access-code", "/dashboard", "/notifications", "/ai-chat"].some(within)) return true;
  if (["/battle", "/battle/profile", "/battle/leaderboard", "/battle/missions", "/battle/social"].includes(path)) return true;
  if (path.startsWith("/mock-test/")) return true;
  if (["synonyms-antonyms", "one-word-substitution", "idioms-phrases"].some(topic => within(`/english/${topic}/study-mode`))) return true;
  return ["mathematics", "reasoning", "english", "general-awareness"].some(subject => path.startsWith(`/${subject}/`)) && path.endsWith("/formula-notes");
}

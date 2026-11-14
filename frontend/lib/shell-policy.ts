/** Fullscreen tools own their navigation and safe-area clearance. */
export function hidesPrimaryNavigation(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  const within = (root: string) => path === root || path.startsWith(`${root}/`);
  if (path.split("/").includes("quiz")) return true;
  if (["/play/session", "/play/setup", "/resource", "/access-code", "/dashboard", "/notifications", "/ai-chat"].some(within)) return true;
  if (within("/battle")) return true;
  if (path.startsWith("/mock-test/")) return true;
  if (/^\/english\/[^/]+\/study-mode(?:\/|$)/.test(path)) return true;
  return ["mathematics", "reasoning", "english", "general-awareness"].some(subject => path.startsWith(`/${subject}/`)) && path.endsWith("/formula-notes");
}

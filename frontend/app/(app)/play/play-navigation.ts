export const playViews: Record<string, string> = {
  mission: "Train Me", mock: "Mock", review: "Review", insights: "Analytics",
};

export function playTab(view: string | null) {
  return view && Object.hasOwn(playViews, view) ? playViews[view] : "Play";
}

export function playHref(search: string, tab: string, exam?: string) {
  const params = new URLSearchParams(search);
  const view = Object.keys(playViews).find(key => playViews[key] === tab);
  if (view) params.set("view", view); else params.delete("view");
  if (exam) params.set("exam", exam);
  const query = params.toString();
  return `/play${query ? `?${query}` : ""}`;
}

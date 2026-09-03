import type { RankedTopic, RankedTopicPriority } from "./ranked-topic-groups";

function toTopicSlug(title: string) {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPriority(rank: number): RankedTopicPriority {
  if (rank <= 10) return "Core";
  if (rank <= 18) return "High";
  return "Medium";
}

const POLITY_TITLES = [
  "Fundamental Rights",
  "Parliament",
  "President and Vice-President",
  "Constitutional Articles, Parts and Schedules",
  "Constitutional Amendments",
  "Supreme Court and High Courts",
  "Prime Minister and Council of Ministers",
  "Directive Principles of State Policy (DPSP) and Fundamental Duties",
  "Making of the Constitution and Constituent Assembly",
  "Preamble",
  "Constitutional and Non-Constitutional Bodies",
  "Governor, Chief Minister and State Council of Ministers",
  "Election Commission and Elections",
  "Citizenship",
  "Emergency Provisions",
  "Salient Features and Sources of the Constitution",
  "Centre–State Relations",
  "State Legislature",
  "Panchayati Raj and Municipalities",
  "Comptroller and Auditor General (CAG)",
  "Finance Commission",
  "Attorney General and Advocate General",
  "Union Public Service Commission and State Public Service Commission",
  "Parliamentary Committees",
  "Political Parties and Anti-Defection Law",
  "Official Language and Special Provisions",
  "Union Territories and Special Areas",
  "Local Government",
] as const;

export const POLITY_TOPICS: readonly RankedTopic[] = POLITY_TITLES.map(
  (title, index) => {
    const rank = index + 1;
    return {
      rank,
      title,
      slug: toTopicSlug(title),
      priority: getPriority(rank),
    };
  }
);

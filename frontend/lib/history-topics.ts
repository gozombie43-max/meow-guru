import type { RankedTopic } from "./ranked-topic-groups";

export const MODERN_HISTORY_TOPICS: readonly RankedTopic[] = [
  { rank: 1, title: "Gandhian Era", slug: "gandhian-era", priority: "Core" },
  { rank: 2, title: "Indian National Congress", slug: "indian-national-congress", priority: "Core" },
  { rank: 3, title: "British Conquest and Expansion in India", slug: "british-conquest-expansion-india", priority: "Core" },
  { rank: 4, title: "Governor-Generals and Viceroys", slug: "governor-generals-viceroys", priority: "Core" },
  { rank: 5, title: "Constitutional Development and British Acts", slug: "constitutional-development-british-acts", priority: "Core" },
  { rank: 6, title: "Revolt of 1857", slug: "revolt-of-1857", priority: "Core" },
  { rank: 7, title: "Final Phase of the Freedom Struggle", slug: "final-phase-freedom-struggle", priority: "Core" },
  { rank: 8, title: "Revolutionary Nationalism", slug: "revolutionary-nationalism", priority: "High" },
  { rank: 9, title: "Socio-Religious Reform Movements", slug: "socio-religious-reform-movements", priority: "High" },
  { rank: 10, title: "Partition of Bengal and Swadeshi Movement", slug: "partition-bengal-swadeshi-movement", priority: "High" },
  { rank: 11, title: "Home Rule Movement and Lucknow Pact", slug: "home-rule-movement-lucknow-pact", priority: "High" },
  { rank: 12, title: "Simon Commission to Civil Disobedience Movement", slug: "simon-commission-civil-disobedience-movement", priority: "High" },
  { rank: 13, title: "Subhas Chandra Bose and Indian National Army", slug: "subhas-chandra-bose-indian-national-army", priority: "High" },
  { rank: 14, title: "Peasant and Tribal Movements", slug: "peasant-tribal-movements", priority: "High" },
  { rank: 15, title: "Advent of Europeans", slug: "advent-of-europeans", priority: "High" },
  { rank: 16, title: "British Land Revenue and Economic Policies", slug: "british-land-revenue-economic-policies", priority: "High" },
  { rank: 17, title: "Education, Press and Social Legislation under British Rule", slug: "education-press-social-legislation-british-rule", priority: "Medium" },
  { rank: 18, title: "Early Political Associations and Nationalist Newspapers", slug: "early-political-associations-nationalist-newspapers", priority: "Medium" },
  { rank: 19, title: "Integration of Princely States and Early Post-Independence India", slug: "integration-princely-states-early-post-independence-india", priority: "Medium" },
];

export const ANCIENT_HISTORY_TOPICS: readonly RankedTopic[] = [
  { rank: 1, title: "Jainism and Buddhism", slug: "jainism-buddhism", priority: "Core" },
  { rank: 2, title: "Mauryan Empire", slug: "mauryan-empire", priority: "Core" },
  { rank: 3, title: "Indus Valley Civilization", slug: "indus-valley-civilization", priority: "Core" },
  { rank: 4, title: "Gupta Empire", slug: "gupta-empire", priority: "Core" },
  { rank: 5, title: "Vedic Age", slug: "vedic-age", priority: "Core" },
  { rank: 6, title: "Ancient Indian Art, Architecture, Literature, Education and Science", slug: "ancient-indian-art-architecture-literature-education-science", priority: "Core" },
  { rank: 7, title: "Mahajanapadas and Rise of Magadha", slug: "mahajanapadas-rise-of-magadha", priority: "High" },
  { rank: 8, title: "Post-Mauryan India", slug: "post-mauryan-india", priority: "High" },
  { rank: 9, title: "Sangam Age", slug: "sangam-age", priority: "High" },
  { rank: 10, title: "Chola Empire", slug: "chola-empire", priority: "High" },
  { rank: 11, title: "Post-Gupta India", slug: "post-gupta-india", priority: "High" },
  { rank: 12, title: "Tripartite Struggle", slug: "tripartite-struggle", priority: "Medium" },
  { rank: 13, title: "Stone Age", slug: "stone-age", priority: "Medium" },
  { rank: 14, title: "Foreign Travellers, Ancient Universities and Texts", slug: "foreign-travellers-ancient-universities-texts", priority: "Medium" },
];

export const MEDIEVAL_HISTORY_TOPICS: readonly RankedTopic[] = [
  { rank: 1, title: "Mughal Empire", slug: "mughal-empire", priority: "Core" },
  { rank: 2, title: "Delhi Sultanate", slug: "delhi-sultanate", priority: "Core" },
  { rank: 3, title: "Bhakti and Sufi Movements", slug: "bhakti-sufi-movements", priority: "Core" },
  { rank: 4, title: "Marathas and Shivaji", slug: "marathas-shivaji", priority: "High" },
  { rank: 5, title: "Vijayanagara and Bahmani Kingdoms", slug: "vijayanagara-bahmani-kingdoms", priority: "High" },
  { rank: 6, title: "Sikh Gurus and Khalsa", slug: "sikh-gurus-khalsa", priority: "High" },
  { rank: 7, title: "Sher Shah Suri and Sur Dynasty", slug: "sher-shah-suri-sur-dynasty", priority: "High" },
  { rank: 8, title: "Medieval Art, Architecture, Literature and Administration", slug: "medieval-art-architecture-literature-administration", priority: "High" },
  { rank: 9, title: "Medieval Travellers", slug: "medieval-travellers", priority: "Medium" },
  { rank: 10, title: "Regional Kingdoms", slug: "regional-kingdoms", priority: "Medium" },
];

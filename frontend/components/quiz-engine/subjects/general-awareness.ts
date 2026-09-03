import type { SubjectConfig } from "../types";

const ANCIENT_CONCEPTS = new Set([
  "pre-historic period", "indus valley civilization", "vedic age", "religious movements: buddhism, jainism",
  "mahajanapadas", "magadha empire & rise of magadha", "persian and greek invasions", "maurya empire",
  "post-mauryan period", "sangam age", "gupta empire", "post-gupta period", "ancient south indian dynasties",
  "art, architecture & literature of ancient india", "ancient indian science, mathematics, astronomy",
]);

const MEDIEVAL_CONCEPTS = new Set([
  "early medieval north india", "arab invasion of sindh", "delhi sultanate", "vijayanagara empire",
  "bahmani kingdom", "bhakti movement", "sufi movement", "mughal empire", "maratha empire",
  "sikh empire", "regional kingdoms", "arrival of europeans",
]);

const MODERN_CONCEPTS = new Set([
  "establishment of british rule", "british administrative & economic policies", "social & religious reform movements",
  "revolt of 1857", "rise of indian nationalism", "indian national congress - formation & early phase",
  "partition of bengal & swadeshi movement", "extremist phase", "revolutionary movements", "home rule movement",
  "gandhian era", "jallianwala bagh massacre", "khilafat movement", "simon commission, round table conferences",
  "poona pact, communal award", "subhas chandra bose & ina", "world war i & ii impact on india",
  "cripps mission, cabinet mission", "partition of india & independence", "integration of princely states",
  "constitutional developments",
]);

export const generalAwarenessConfig: SubjectConfig = {
  subjectId: "general-awareness",
  subjectLabel: "General Awareness",
  cssClassName: "general-awareness-quiz",
  formulaModeLabel: "Fact Practice",
  topicConcepts: {
    "ancient-history": [
      "Pre-historic period", "Indus Valley Civilization", "Vedic Age", "Religious movements: Buddhism, Jainism",
      "Mahajanapadas", "Magadha Empire & rise of Magadha", "Persian and Greek invasions", "Maurya Empire",
      "Post-Mauryan period", "Sangam Age", "Gupta Empire", "Post-Gupta period", "Ancient South Indian dynasties",
      "Art, architecture & literature of ancient India", "Ancient Indian science, mathematics, astronomy",
    ],
    "medieval-history": [
      "Early medieval North India", "Arab invasion of Sindh", "Delhi Sultanate", "Vijayanagara Empire",
      "Bahmani Kingdom", "Bhakti Movement", "Sufi Movement", "Mughal Empire", "Maratha Empire", "Sikh Empire",
      "Regional kingdoms",
    ],
    "modern-history": [
      "Arrival of Europeans", "Establishment of British rule",
      "British administrative & economic policies", "Social & religious reform movements", "Revolt of 1857",
      "Rise of Indian nationalism", "Indian National Congress - formation & early phase",
      "Partition of Bengal & Swadeshi Movement", "Extremist phase", "Revolutionary movements", "Home Rule Movement",
      "Gandhian Era", "Jallianwala Bagh Massacre", "Khilafat Movement", "Simon Commission, Round Table Conferences",
      "Poona Pact, Communal Award", "Subhas Chandra Bose & INA", "World War I & II impact on India",
      "Cripps Mission, Cabinet Mission", "Partition of India & Independence", "Integration of princely states",
      "Constitutional developments",
    ],
    polity: ["Constitution", "Governance", "Parliament", "Judiciary", "Federal Structure"],
    geography: ["Physical Geography", "Indian Geography", "World Geography", "Climate and Weather", "Maps and Locations"],
    physics: ["Mechanics", "Heat", "Sound", "Light", "Electricity", "Modern Physics"],
    chemistry: ["Matter", "Atomic Structure", "Periodic Table", "Chemical Reactions", "Carbon Compounds", "Everyday Chemistry"],
    biology: ["Human Biology", "Health and Disease", "Cell and Genetics", "Plant Biology", "Animal Biology", "Ecology"],
    economy: ["Indian Economy", "Budget and Taxation", "Banking", "Schemes and Policies", "Inflation and Growth"],
    "current-affairs": ["National Affairs", "International Affairs", "Awards and Honors", "Sports", "Reports and Indices"],
    "static-gk": ["National Symbols", "Culture and Heritage", "Organizations", "Books and Authors", "Important Days"],
  },
  classificationCategories: [
    { id: "ancient", label: "Ancient History", icon: "Anc", accent: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.28)" },
    { id: "medieval", label: "Medieval History", icon: "Med", accent: "#10b981", bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.28)" },
    { id: "modern", label: "Modern History", icon: "Mod", accent: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.28)" },
    { id: "core", label: "Core Topics", icon: "Cor", accent: "#ec4899", bg: "rgba(236, 72, 153, 0.1)", border: "rgba(236, 72, 153, 0.28)" },
    { id: "other", label: "General", icon: "...", accent: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)", border: "rgba(167, 139, 250, 0.28)" },
  ],
  getClassificationCategoryId(concept: string): string {
    const norm = concept.toLowerCase().trim();
    if (ANCIENT_CONCEPTS.has(norm) || norm.includes("ancient") || norm.includes("vedic") || norm.includes("maurya") || norm.includes("indus") || norm.includes("gupta") || norm.includes("buddhism")) return "ancient";
    if (MEDIEVAL_CONCEPTS.has(norm) || norm.includes("medieval") || norm.includes("mughal") || norm.includes("delhi sultanate") || norm.includes("bhakti") || norm.includes("sufi") || norm.includes("vijayanagara") || norm.includes("maratha")) return "medieval";
    if (MODERN_CONCEPTS.has(norm) || norm.includes("modern") || norm.includes("british") || norm.includes("gandhi") || norm.includes("revolt") || norm.includes("congress") || norm.includes("independence")) return "modern";
    if (norm.includes("constitution") || norm.includes("geography") || norm.includes("economy") || norm.includes("physics") || norm.includes("chemistry") || norm.includes("biology") || norm.includes("science") || norm.includes("affairs") || norm.includes("polity") || norm.includes("budget") || norm.includes("banking") || norm.includes("schemes")) return "core";
    return "other";
  },
};

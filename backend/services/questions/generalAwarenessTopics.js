function toTopicSlug(title) {
  return String(title || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function expandNormalizedKeys(title, slug) {
  const rawTitle = String(title || "").trim();
  const rawSlug = String(slug || toTopicSlug(rawTitle)).trim();
  const withAnd = rawTitle.replace(/&/g, " and ");
  const withoutAnd = rawTitle.replace(/\band\b/gi, "&");
  return [
    normalizeKey(rawTitle),
    normalizeKey(rawSlug),
    normalizeKey(withAnd),
    normalizeKey(withoutAnd),
  ].filter(Boolean);
}

export const GENERAL_AWARENESS_CHAPTERS_BY_TOPIC = {
  geography: [
    { title: "Indian Rivers & Drainage System", slug: "indian-rivers-drainage-system" },
    { title: "Physiography of India", slug: "physiography-of-india" },
    { title: "Soil & Agriculture", slug: "soil-agriculture" },
    { title: "National Parks, Wildlife Sanctuaries, Tiger Reserves & Biosphere Reserves", slug: "national-parks-wildlife-sanctuaries-tiger-reserves-biosphere-reserves" },
    { title: "Indian Climate & Monsoon", slug: "indian-climate-monsoon" },
    { title: "India: Location, States, UTs, Boundaries & Neighbouring Countries", slug: "india-location-states-uts-boundaries-neighbouring-countries" },
    { title: "World Map & Important Geographical Locations", slug: "world-map-important-geographical-locations" },
    { title: "Solar System & Universe", slug: "solar-system-universe" },
    { title: "Mountains, Plateaus, Plains, Ghats & Mountain Passes of India", slug: "mountains-plateaus-plains-ghats-mountain-passes-india" },
    { title: "Atmosphere, Weather & Climate", slug: "atmosphere-weather-climate" },
    { title: "Minerals & Energy Resources", slug: "minerals-energy-resources" },
    { title: "Forests, Grasslands, Natural Vegetation & Wildlife", slug: "forests-grasslands-natural-vegetation-wildlife" },
    { title: "Dams, Reservoirs, Lakes, Waterfalls & Wetlands", slug: "dams-reservoirs-lakes-waterfalls-wetlands" },
    { title: "Oceanography — Oceans, Currents, Tides & Waves", slug: "oceanography-oceans-currents-tides-waves" },
    { title: "Earth Interior, Plate Tectonics, Earthquakes & Volcanoes", slug: "earth-interior-plate-tectonics-earthquakes-volcanoes" },
    { title: "World Physical Geography", slug: "world-physical-geography" },
    { title: "Transport Geography — Railways, Roads, Ports & Waterways", slug: "transport-geography-railways-roads-ports-waterways" },
    { title: "Population, Census & Human Geography", slug: "population-census-human-geography" },
    { title: "Industries & Industrial Regions", slug: "industries-industrial-regions" },
    { title: "Latitude, Longitude, Rotation, Revolution & Time Zones", slug: "latitude-longitude-rotation-revolution-time-zones" },
    { title: "Seas, Gulfs, Bays, Straits, Channels & Canals", slug: "seas-gulfs-bays-straits-channels-canals" },
    { title: "Geomorphology & Landforms", slug: "geomorphology-landforms" },
    { title: "Rocks, Minerals & Rock Cycle", slug: "rocks-minerals-rock-cycle" },
    { title: "Cyclones, Anticyclones & Local Winds", slug: "cyclones-anticyclones-local-winds" },
    { title: "Water in the Atmosphere — Humidity, Clouds, Rainfall & Precipitation", slug: "water-atmosphere-humidity-clouds-rainfall-precipitation" },
    { title: "Water Resources, Irrigation & Groundwater", slug: "water-resources-irrigation-groundwater" },
    { title: "Natural Disasters & Hazards", slug: "natural-disasters-hazards" },
    { title: "World Climate & Natural Vegetation", slug: "world-climate-natural-vegetation" },
    { title: "Environmental Geography & Ecology", slug: "environmental-geography-ecology" },
    { title: "World Human & Economic Geography", slug: "world-human-economic-geography" },
  ],
  polity: [
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
  ].map((title) => ({ title, slug: toTopicSlug(title) })),
  "ancient-history": [
    { title: "Jainism and Buddhism", slug: "jainism-buddhism" },
    { title: "Mauryan Empire", slug: "mauryan-empire" },
    { title: "Indus Valley Civilization", slug: "indus-valley-civilization" },
    { title: "Gupta Empire", slug: "gupta-empire" },
    { title: "Vedic Age", slug: "vedic-age" },
    { title: "Ancient Indian Art, Architecture, Literature, Education and Science", slug: "ancient-indian-art-architecture-literature-education-science" },
    { title: "Mahajanapadas and Rise of Magadha", slug: "mahajanapadas-rise-of-magadha" },
    { title: "Post-Mauryan India", slug: "post-mauryan-india" },
    { title: "Sangam Age", slug: "sangam-age" },
    { title: "Chola Empire", slug: "chola-empire" },
    { title: "Post-Gupta India", slug: "post-gupta-india" },
    { title: "Tripartite Struggle", slug: "tripartite-struggle" },
    { title: "Stone Age", slug: "stone-age" },
    { title: "Foreign Travellers, Ancient Universities and Texts", slug: "foreign-travellers-ancient-universities-texts" },
  ],
  "medieval-history": [
    { title: "Mughal Empire", slug: "mughal-empire" },
    { title: "Delhi Sultanate", slug: "delhi-sultanate" },
    { title: "Bhakti and Sufi Movements", slug: "bhakti-sufi-movements" },
    { title: "Marathas and Shivaji", slug: "marathas-shivaji" },
    { title: "Vijayanagara and Bahmani Kingdoms", slug: "vijayanagara-bahmani-kingdoms" },
    { title: "Sikh Gurus and Khalsa", slug: "sikh-gurus-khalsa" },
    { title: "Sher Shah Suri and Sur Dynasty", slug: "sher-shah-suri-sur-dynasty" },
    { title: "Medieval Art, Architecture, Literature and Administration", slug: "medieval-art-architecture-literature-administration" },
    { title: "Medieval Travellers", slug: "medieval-travellers" },
    { title: "Regional Kingdoms", slug: "regional-kingdoms" },
  ],
  "modern-history": [
    { title: "Gandhian Era", slug: "gandhian-era" },
    { title: "Indian National Congress", slug: "indian-national-congress" },
    { title: "British Conquest and Expansion in India", slug: "british-conquest-expansion-india" },
    { title: "Governor-Generals and Viceroys", slug: "governor-generals-viceroys" },
    { title: "Constitutional Development and British Acts", slug: "constitutional-development-british-acts" },
    { title: "Revolt of 1857", slug: "revolt-of-1857" },
    { title: "Final Phase of the Freedom Struggle", slug: "final-phase-freedom-struggle" },
    { title: "Revolutionary Nationalism", slug: "revolutionary-nationalism" },
    { title: "Socio-Religious Reform Movements", slug: "socio-religious-reform-movements" },
    { title: "Partition of Bengal and Swadeshi Movement", slug: "partition-bengal-swadeshi-movement" },
    { title: "Home Rule Movement and Lucknow Pact", slug: "home-rule-movement-lucknow-pact" },
    { title: "Simon Commission to Civil Disobedience Movement", slug: "simon-commission-civil-disobedience-movement" },
    { title: "Subhas Chandra Bose and Indian National Army", slug: "subhas-chandra-bose-indian-national-army" },
    { title: "Peasant and Tribal Movements", slug: "peasant-tribal-movements" },
    { title: "Advent of Europeans", slug: "advent-of-europeans" },
    { title: "British Land Revenue and Economic Policies", slug: "british-land-revenue-economic-policies" },
    { title: "Education, Press and Social Legislation under British Rule", slug: "education-press-social-legislation-british-rule" },
    { title: "Early Political Associations and Nationalist Newspapers", slug: "early-political-associations-nationalist-newspapers" },
    { title: "Integration of Princely States and Early Post-Independence India", slug: "integration-princely-states-early-post-independence-india" },
  ],
  physics: [
    "Units, Measurements and Measuring Instruments",
    "Motion",
    "Force and Laws of Motion",
    "Work, Energy and Power",
    "Gravitation",
    "Heat and Temperature",
    "Sound",
    "Light — Reflection and Refraction",
    "Electricity",
    "Magnetism and Magnetic Effect of Electric Current",
    "Pressure and Properties of Fluids",
    "Waves",
    "Human Eye, Optical Instruments and Vision",
    "Simple Machines",
    "Sources of Energy",
    "Electronics and Semiconductors",
    "Atomic and Nuclear Physics",
    "Scientific Instruments and Important Inventions",
  ].map((title) => ({ title, slug: toTopicSlug(title) })),
  chemistry: [
    "Matter and Its Properties",
    "Atomic Structure",
    "Periodic Table",
    "Acids, Bases and Salts",
    "Metals and Non-Metals",
    "Chemical Reactions and Equations",
    "Carbon and Its Compounds",
    "Elements, Compounds and Mixtures",
    "Physical and Chemical Changes",
    "Chemical Bonding and Valency",
    "Solutions and Separation Techniques",
    "Oxidation and Reduction",
    "Electrochemistry and Electrolysis",
    "Common Chemicals and Their Uses",
    "Fuels and Combustion",
    "Alloys",
    "Environmental Chemistry",
    "Chemistry in Everyday Life",
  ].map((title) => ({ title, slug: toTopicSlug(title) })),
  biology: [
    "Human Body Systems",
    "Diseases and Immunity",
    "Nutrition, Vitamins and Deficiency Diseases",
    "Cell",
    "Genetics and Heredity",
    "Plant Physiology",
    "Animal Tissues",
    "Plant Tissues",
    "Classification of Living Organisms",
    "Reproduction",
    "Nervous System",
    "Hormones and Endocrine System",
    "Circulatory and Excretory System",
    "Digestive and Respiratory System",
    "Plant Kingdom",
    "Animal Kingdom",
    "Ecology and Ecosystem",
    "Evolution",
    "Microorganisms",
    "Biotechnology",
  ].map((title) => ({ title, slug: toTopicSlug(title) })),
  economy: [
    "Basics of Economics",
    "National Income",
    "Money and Banking",
    "Inflation and Unemployment",
    "Budget and Taxation",
    "Monetary Policy",
    "Fiscal Policy",
    "Indian Banking System and RBI",
    "Economic Planning in India",
    "Poverty and Human Development",
    "Agriculture and Indian Economy",
    "Industry and Infrastructure",
    "Balance of Payments and Foreign Trade",
    "Financial Markets",
    "International Economic Organisations",
    "Government Schemes and Economic Institutions",
    "Demography and Census",
  ].map((title) => ({ title, slug: toTopicSlug(title) })),
  "static-gk": [
    "Important Days and Themes",
    "Awards and Honours",
    "Books and Authors",
    "Sports and Tournaments",
    "National and International Organisations",
    "Art and Culture",
    "Classical and Folk Dances",
    "Music and Musical Instruments",
    "Festivals of India",
    "Important Monuments and Places",
    "Firsts, Largest, Longest and Superlatives",
    "Famous Personalities",
    "Census",
    "Countries, Capitals and Currencies",
    "National Symbols",
    "Important Government Institutions",
    "World Heritage Sites",
    "Important Headquarters",
  ].map((title) => ({ title, slug: toTopicSlug(title) })),
};

const GROUP_BY_NORMALIZED_KEY = new Map();
const GROUP_KEYS_MAP = new Map();
const GROUP_STRINGS_MAP = new Map();

for (const [groupSlug, chapters] of Object.entries(GENERAL_AWARENESS_CHAPTERS_BY_TOPIC)) {
  const normGroup = normalizeKey(groupSlug);
  GROUP_BY_NORMALIZED_KEY.set(normGroup, groupSlug);
  const keySet = new Set([normGroup]);
  const strSet = new Set([groupSlug]);
  for (const ch of chapters) {
    for (const k of expandNormalizedKeys(ch.title, ch.slug)) {
      keySet.add(k);
    }
    strSet.add(ch.title);
    strSet.add(ch.slug);
    strSet.add(ch.title.replace(/&/g, "and"));
    strSet.add(ch.title.replace(/\band\b/gi, "&"));
  }
  GROUP_KEYS_MAP.set(groupSlug, Array.from(keySet));
  GROUP_STRINGS_MAP.set(groupSlug, Array.from(strSet));
}

export function resolveGeneralAwarenessTopicGroupSlug(topic) {
  if (!topic) return null;
  return GROUP_BY_NORMALIZED_KEY.get(normalizeKey(topic)) || null;
}

export function getGeneralAwarenessGroupTopicKeys(topic) {
  const slug = resolveGeneralAwarenessTopicGroupSlug(topic);
  return slug ? GROUP_KEYS_MAP.get(slug) || [] : [];
}

export function getGeneralAwarenessChapterKeys(chapter) {
  if (!chapter) return [];
  return Array.from(new Set(expandNormalizedKeys(chapter, toTopicSlug(chapter))));
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function caseInsensitiveExact(value) {
  return new RegExp(`^${escapeRegex(String(value || "").trim())}$`, "i");
}

export function buildGeneralAwarenessTopicCondition(topic, normalized) {
  const slug = resolveGeneralAwarenessTopicGroupSlug(topic);
  if (!slug) return null;
  if (normalized) {
    const keys = GROUP_KEYS_MAP.get(slug) || [normalizeKey(slug)];
    return {
      $or: [
        { topicKey: { $in: keys } },
        { topicGroup: caseInsensitiveExact(slug) },
      ],
    };
  }
  const strings = GROUP_STRINGS_MAP.get(slug) || [slug];
  const regexes = strings.map(caseInsensitiveExact);
  return {
    $or: [
      { topic: { $in: regexes } },
      { chapter: { $in: regexes } },
      { chapterSlug: { $in: regexes } },
      { topicGroup: caseInsensitiveExact(slug) },
    ],
  };
}

export function buildGeneralAwarenessChapterCondition(chapter, normalized) {
  const trimmed = String(chapter || "").trim();
  if (!trimmed) return null;
  const slug = toTopicSlug(trimmed);
  const withAnd = trimmed.replace(/&/g, "and");
  const withAmp = trimmed.replace(/\band\b/gi, "&");
  const chapterRegexes = Array.from(new Set([trimmed, slug, withAnd, withAmp])).map(caseInsensitiveExact);

  if (normalized) {
    const keys = getGeneralAwarenessChapterKeys(trimmed);
    return {
      $or: [
        { topicKey: { $in: keys } },
        { chapter: { $in: chapterRegexes } },
        { chapterSlug: caseInsensitiveExact(slug) },
      ],
    };
  }
  return {
    $or: [
      { topic: { $in: chapterRegexes } },
      { chapter: { $in: chapterRegexes } },
      { chapterSlug: caseInsensitiveExact(slug) },
    ],
  };
}

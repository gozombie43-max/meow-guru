import type { RankedTopic } from "./ranked-topic-groups";

function toTopicSlug(title: string) {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function createRankedTopics(
  titles: readonly string[],
  coreThrough: number,
  highThrough: number
): readonly RankedTopic[] {
  return titles.map((title, index) => {
    const rank = index + 1;
    return {
      rank,
      title,
      slug: toTopicSlug(title),
      priority: rank <= coreThrough ? "Core" : rank <= highThrough ? "High" : "Medium",
    };
  });
}

export const PHYSICS_TOPICS = createRankedTopics([
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
], 6, 12);

export const CHEMISTRY_TOPICS = createRankedTopics([
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
], 6, 12);

export const BIOLOGY_TOPICS = createRankedTopics([
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
], 7, 14);

export const ECONOMY_TOPICS = createRankedTopics([
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
], 6, 12);

export const STATIC_GK_TOPICS = createRankedTopics([
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
], 6, 12);

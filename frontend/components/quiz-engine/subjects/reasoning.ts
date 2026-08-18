import type { SubjectConfig } from "../types";

export const reasoningConfig: SubjectConfig = {
  subjectId: "reasoning",
  subjectLabel: "Reasoning",
  cssClassName: "reasoning-quiz",
  formulaModeLabel: "Pattern Practice",
  topicConcepts: {
    "coding-decoding": [
      "Letter Coding", "Number Coding", "Symbolic Coding",
      "Numerical Operations", "Mixed Coding",
    ],
    "syllogism-inferences": [
      "Two Statement", "Three Statement",
      "Possibility Cases", "Drawing Inferences",
    ],
    "puzzle-seating-arrangement": [
      "Linear Seating", "Circular Seating", "Floor Puzzle",
      "Box Puzzle", "Day/Month Puzzle",
    ],
    series: [
      "Number Series", "Letter Series", "Figural Series",
      "Alpha-Numeric Series", "Trends",
    ],
    analogy: [
      "Semantic Analogy", "Symbolic/Number Analogy",
      "Figural Analogy", "Word Analogy",
    ],
    "classification-odd-one-out": [
      "Semantic Classification", "Figural Classification",
      "Symbolic Classification", "Number Based",
    ],
    "blood-relations": [
      "Family Tree", "Coded Blood Relations", "Statement Based",
    ],
    "direction-distance": [
      "Basic 8 Directions", "Distance Calculation",
      "Shadow Problems", "Space Orientation",
    ],
    "venn-diagram": [
      "Relationship Diagrams", "Finding Elements",
      "Shaded Region", "3-Circle Venn",
    ],
    inequalities: [
      "Direct Inequalities", "Coded Inequalities",
      "Mathematical Inequalities",
    ],
    "mathematical-symbolic-operations": [
      "BODMAS Based", "Symbol Substitution",
      "Sign Interchange", "Numerical Operations",
    ],
    "order-ranking": [
      "Position from Top/Bottom", "Rank in Row/Column",
      "Height/Weight Ordering",
    ],
    "statement-conclusion": [
      "Follows/Does Not Follow", "Implicit Conclusions",
      "Critical Thinking",
    ],
    "statement-assumptions": [
      "Implicit Assumptions", "Explicit Assumptions",
    ],
    "statement-arguments": [
      "Strong/Weak Arguments", "Course of Action",
      "Cause & Effect",
    ],
    "problem-solving-critical-thinking": [
      "Applied Logical Reasoning", "Step-based Problems",
      "Condition Based",
    ],
    "non-verbal-figures": [
      "Embedded Figures", "Figure Completion",
      "Counting Figures", "Figural Pattern",
    ],
    "paper-folding-cutting": [
      "Punched Hole", "Pattern Folding & Unfolding",
      "Figural Pattern-folding",
    ],
    "mirror-water-image": [
      "Letter/Number Mirror", "Clock Mirror Image",
      "Figural Mirror", "Water Image",
    ],
    "cube-dice": [
      "Open/Closed Dice", "Face Opposite",
      "Cube Painting & Cutting", "3D Orientation",
    ],
    matrix: [
      "Missing Number/Letter", "Row-Column Coding",
      "Figure Matrix",
    ],
    "logical-sequence-of-words": [
      "Dictionary Order", "Process/Hierarchy Order",
      "Word Building",
    ],
    "emotional-intelligence": [
      "Recognising Emotions", "Empathy Based",
      "Situational EQ", "Self-awareness",
    ],
    "social-intelligence": [
      "Socially Appropriate Responses",
      "Interpersonal Situations", "Group Behavior",
    ],
    "word-building": [
      "Form Words from Letters", "Find Words Within Words",
      "Meaningful Word Formation",
    ],
  },
  classificationCategories: [
    { id: "num", label: "Number Based", icon: "123", accent: "#fb923c", bg: "rgba(251, 146, 60, 0.1)", border: "rgba(251, 146, 60, 0.28)" },
    { id: "let", label: "Letter Clusters", icon: "ABC", accent: "#2dd4a0", bg: "rgba(45, 212, 160, 0.1)", border: "rgba(45, 212, 160, 0.28)" },
    { id: "word", label: "Word Pairs", icon: "Aa", accent: "#d946ef", bg: "rgba(217, 70, 239, 0.1)", border: "rgba(217, 70, 239, 0.28)" },
    { id: "sym", label: "Symbolic / Figural", icon: "<>", accent: "#38bdf8", bg: "rgba(56, 189, 248, 0.1)", border: "rgba(56, 189, 248, 0.28)" },
    { id: "other", label: "General", icon: "...", accent: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)", border: "rgba(167, 139, 250, 0.28)" },
  ],
  getClassificationCategoryId(concept: string): string {
    const normalized = concept.toLowerCase();
    if (normalized.includes("number") || normalized.includes("digit")) return "num";
    if (normalized.includes("letter") || normalized.includes("cluster")) return "let";
    if (normalized.includes("word") || normalized.includes("semantic") || normalized.includes("mood")) return "word";
    if (normalized.includes("figural") || normalized.includes("figure") || normalized.includes("symbol")) return "sym";
    return "other";
  },
};

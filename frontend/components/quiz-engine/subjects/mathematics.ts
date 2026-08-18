import type { SubjectConfig } from "../types";

export const mathematicsConfig: SubjectConfig = {
  subjectId: "mathematics",
  subjectLabel: "Mathematics",
  cssClassName: "mathematics-quiz",
  topicConcepts: {
    algebra: ["Algebraic Identities", "Quadratic Equations", "Simplification", "Surds & Indices", "Polynomials", "Linear Equations", "Factorization"],
    geometry: ["Triangles & Angles", "Circles & Tangents", "Quadrilaterals & Polygons", "Similarity & Congruency", "Coordinate Geometry", "Theorems & Properties"],
    trigonometry: ["Trigonometric Identities", "Heights & Distances", "Angle Measurement", "Maxima & Minima", "Inverse Trigonometry", "Standard Ratios"],
    mensuration: ["2D Areas & Perimeters", "3D Surface Area & Volume", "Prisms & Pyramids", "Cylinders & Cones", "Spheres & Hemispheres", "Combined Solids"],
    "number-system": ["Divisibility & Remainders", "HCF & LCM", "Unit Digit & Trailing Zeros", "Fractions & Decimals", "Surds & Simplification", "Number Classification"],
    "statistics-probability": ["Mean, Median & Mode", "Standard Deviation & Variance", "Probability & Events", "Permutations & Combinations", "Data Interpretation"],
    averages: ["Arithmetic Mean", "Weighted Average", "Median & Mode", "Grouped Data", "Consecutive Numbers"],
    discount: ["Single Discount", "Successive Discounts", "Net Price", "Marked Price vs CP", "Promotional Offers"],
    interest: ["Simple Interest Formula", "Compound Interest Formula", "CI Compounding Periods", "Rate & Time Changes", "SI vs CI Difference"],
    "mixture-and-alligation": ["Alligation Rule", "Mixture Ratio", "Cost Price Average", "Quantity Replacement", "Liquid & Solutions"],
    partnership: ["Capital Ratio", "Profit Sharing", "Time-Weighted Share", "Active vs Sleeping Partner", "New & Leaving Partner"],
    percentages: ["Percentage Increase", "Percentage Decrease", "Value Changes", "Fraction to Percentage Conversion", "Successive Changes"],
    "profit-and-loss": ["Cost Price & Selling Price", "Profit & Loss Percentage", "Markup & Markdown", "Dishonest Dealer", "Successive Selling"],
    "ratio-and-proportion": ["Fundamental Ratio", "Proportion & Continued Ratio", "Part-to-Whole", "Mixture Ratios", "Coins & Denominations"],
    "square-roots": ["Perfect Squares & Cubes", "Root Simplification", "Estimation of Roots", "Radical Operations", "Surds Expressions"],
    "time-and-distance": ["Speed, Distance & Time", "Relative Speed & Trains", "Average Speed", "Boats & Streams", "Races & Circular Motion"],
    "time-and-work": ["Work Rate & Efficiency", "Combined Work & Alternating Days", "Pipe & Cisterns", "Man-Day Formula", "Wages & Shares"],
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

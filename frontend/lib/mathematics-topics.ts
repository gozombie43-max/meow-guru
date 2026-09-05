// Canonical Mathematics URLs; aliases retain existing bookmarked routes.
export const MATHEMATICS_TOPICS = {
  algebra: {
    slug: "algebra",
    label: "Algebra",
    group: "advance",
    route: "/mathematics/advance/algebra",
    aliases: ["/mathematics/algebra"],
    mensurationModes: false,
  },
  geometry: {
    slug: "geometry",
    label: "Geometry",
    group: "advance",
    route: "/mathematics/advance/geometry",
    aliases: ["/mathematics/geometry"],
    mensurationModes: false,
  },
  mensuration: {
    slug: "mensuration",
    label: "Mensuration",
    group: "advance",
    route: "/mathematics/advance/mensuration",
    aliases: ["/mathematics/mensuration"],
    mensurationModes: true,
  },
  trigonometry: {
    slug: "trigonometry",
    label: "Trigonometry",
    group: "advance",
    route: "/mathematics/advance/trigonometry",
    aliases: ["/mathematics/trigonometry"],
    mensurationModes: false,
  },
  "number-system": {
    slug: "number-system",
    label: "Number System",
    group: "advance",
    route: "/mathematics/advance/number-system",
    aliases: [
      "/mathematics/number-system",
      "/mathematics/arithmetic/number-system",
    ],
    mensurationModes: false,
  },
  "statistics-probability": {
    slug: "statistics-probability",
    label: "Statistics & Probability",
    group: "top-level",
    route: "/mathematics/statistics-probability",
    aliases: [],
    mensurationModes: false,
  },
  averages: {
    slug: "averages",
    label: "Averages",
    group: "arithmetic",
    route: "/mathematics/arithmetic/averages",
    aliases: [],
    mensurationModes: false,
  },
  discount: {
    slug: "discount",
    label: "Discount",
    group: "arithmetic",
    route: "/mathematics/arithmetic/discount",
    aliases: [],
    mensurationModes: false,
  },
  interest: {
    slug: "interest",
    label: "Interest",
    group: "arithmetic",
    route: "/mathematics/arithmetic/interest",
    aliases: [],
    mensurationModes: false,
  },
  "mixture-and-alligation": {
    slug: "mixture-and-alligation",
    label: "Mixture & Alligation",
    group: "arithmetic",
    route: "/mathematics/arithmetic/mixture-and-alligation",
    aliases: [],
    mensurationModes: false,
  },
  partnership: {
    slug: "partnership",
    label: "Partnership",
    group: "arithmetic",
    route: "/mathematics/arithmetic/partnership",
    aliases: [],
    mensurationModes: false,
  },
  percentages: {
    slug: "percentages",
    label: "Percentages",
    group: "arithmetic",
    route: "/mathematics/arithmetic/percentages",
    aliases: [],
    mensurationModes: false,
  },
  "profit-and-loss": {
    slug: "profit-and-loss",
    label: "Profit & Loss",
    group: "arithmetic",
    route: "/mathematics/arithmetic/profit-and-loss",
    aliases: [],
    mensurationModes: false,
  },
  "ratio-and-proportion": {
    slug: "ratio-and-proportion",
    label: "Ratio & Proportion",
    group: "arithmetic",
    route: "/mathematics/arithmetic/ratio-and-proportion",
    aliases: [],
    mensurationModes: false,
  },
  "square-roots": {
    slug: "square-roots",
    label: "Square Roots",
    group: "arithmetic",
    route: "/mathematics/arithmetic/square-roots",
    aliases: [],
    mensurationModes: false,
  },
  "time-and-distance": {
    slug: "time-and-distance",
    label: "Time & Distance",
    group: "arithmetic",
    route: "/mathematics/arithmetic/time-and-distance",
    aliases: [],
    mensurationModes: false,
  },
  "time-and-work": {
    slug: "time-and-work",
    label: "Time & Work",
    group: "arithmetic",
    route: "/mathematics/arithmetic/time-and-work",
    aliases: [],
    mensurationModes: false,
  },
} as const;
export function mathematicsTopicsForRoute(
  group: "advance" | "arithmetic" | "top-level",
) {
  const prefix =
    group === "top-level" ? "/mathematics/" : `/mathematics/${group}/`;
  return Object.values(MATHEMATICS_TOPICS)
    .filter((topic) =>
      [topic.route, ...topic.aliases].some(
        (route) =>
          route.startsWith(prefix) && !route.slice(prefix.length).includes("/"),
      ),
    )
    .map((topic) => topic.slug);
}
export function mathematicsTopicRoute(slug: string) {
  return (
    MATHEMATICS_TOPICS[slug as keyof typeof MATHEMATICS_TOPICS]?.route ??
    `/mathematics/${slug}`
  );
}

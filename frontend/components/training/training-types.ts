export const modes = [
  {
    id: "adaptive",
    title: "Adaptive",
    category: "AI",
    eyebrow: "Find your next breakthrough",
    description:
      "A balanced mix shaped by weak topics, recent practice and due reviews.",
    detail:
      "Difficulty responds to each answer. Confidence distinguishes mastery from a lucky guess.",
    time: "Personalized mix",
    icon: "brain",
  },
  {
    id: "challenge",
    title: "AI Challenge",
    category: "AI",
    eyebrow: "Discover your limits",
    description:
      "Climb through harder questions, with easier checks along the way.",
    detail:
      "Validated bank questions probe your difficulty boundary. Live AI variants are not enabled.",
    time: "Difficulty ladder",
    icon: "target",
  },
  {
    id: "sprint",
    title: "Sprint",
    category: "Speed",
    eyebrow: "Make accuracy faster",
    description:
      "Short bursts focused on questions you know, but solve too slowly.",
    detail:
      "Choose 5, 10 or 15 minutes. Answer or skip to move forward; compare your time with the target.",
    time: "5 / 10 / 15 min",
    icon: "zap",
  },
  {
    id: "pressure",
    title: "Pressure",
    category: "Speed",
    eyebrow: "Spend your seconds wisely",
    description: "Less time. Deliberate choices. Solve, skip, return or leave.",
    detail:
      "You get 70% of the catalog target time. Navigate freely and review where your time went.",
    time: "70% of target time",
    icon: "timer",
  },
  {
    id: "section",
    title: "Section",
    category: "Sectional",
    eyebrow: "Build sectional command",
    description:
      "Focus on one subject or topic with a measured practice session.",
    detail:
      "Choose subject, topic and length. Actual exam timing and marking live under Mock.",
    time: "25 / 50 questions",
    icon: "layers",
  },
  {
    id: "gauntlet",
    title: "Gauntlet",
    category: "Sectional",
    eyebrow: "Hold up across topics",
    description: "Sequential topic blocks expose where your performance drops.",
    detail:
      "Questions stay grouped by topic and rise in difficulty within each block. Move forward only.",
    time: "Topic blocks",
    icon: "route",
  },
  {
    id: "nightmare",
    title: "AI Nightmare",
    category: "Extreme",
    eyebrow: "Meet your hardest work",
    description:
      "Hard questions, tighter targets and no hints until the finish.",
    detail:
      "Only hard or higher bank questions qualify. Generated variants require prior validation.",
    time: "Hard questions only",
    icon: "flame",
  },
  {
    id: "survival",
    title: "Survival",
    category: "Extreme",
    eyebrow: "Three lives. Stay precise.",
    description:
      "An escalating run through hard questions and personal weak spots.",
    detail:
      "A wrong answer or skip costs one life. Two consecutive slow solves cost another. Answers reveal only at the end.",
    time: "3 lives",
    icon: "shield",
  },
] as const;
export type ModeId = (typeof modes)[number]["id"] | "review" | "mission";
export type Confidence = "sure" | "unsure" | "guess";
export const mistakeTypes = [
  "Concept Gap",
  "Calculation Error",
  "Misread",
  "Memory/Formula",
  "Bad Elimination",
  "Time Management",
  "Guessing",
];
export interface TrainingQuestion {
  trainingBlock?: string;
  trainingBlockId?: string;
  trainingMode?: ModeId;
  id: string;
  text: string;
  options: string[];
  image: string;
  subject: string;
  topic: string;
  subtopic: string;
  difficulty: number;
  expectedTime: number;
  targetSource: string;
  sourceType: string;
  correctIndex?: number;
  solution?: string;
}
export interface ResultRow {
  questionId: string;
  number: number;
  topic: string;
  attempted: boolean;
  correct: boolean;
  choice: number | null;
  correctIndex: number;
  seconds: number;
  target: number;
  confidence: Confidence | null;
  mistake: string | null;
  solution: string;
  score: number;
}
export interface TrainingSession {
  id: string;
  mode: ModeId;
  effectiveMode: ModeId;
  policy: TrainingModePolicy;
  allowedVisitIndices: number[];
  exam: string;
  status: "active" | "completed" | "abandoned";
  completionReason: "submitted" | "timeout" | "survival_lives" | "abandoned" | null;
  revision: number;
  current: number;
  duration: number;
  deadline: string;
  serverNow: number;
  lastEventAt: number;
  lives: number;
  marking: { correct: number; wrong: number };
  questions: TrainingQuestion[];
  answers: Record<
    string,
    { choice: number | null; seconds: number; confidence: Confidence | null }
  >;
  result: null | {
    rows: ResultRow[];
    blockBreakdown?: Array<{
      id: string;
      label: string;
      mode: ModeId;
      attempted: number;
      correct: number;
      questions: number;
      seconds: number;
      accuracy: number;
      averageSeconds: number;
    }>;
    attempted: number;
    correct: number;
    accuracy: number;
    score: number;
    maxScore: number;
    negativeLoss: number;
    secondsSaved: number;
    averageSeconds: number;
    findings: string[];
    failureMap: Record<string, number>;
    modePoints: number;
    masteryDelta?: Array<{
      key: string;
      topic: string;
      before: number;
      after: number;
      delta: number;
    }>;
    bestStreak: number;
    questionsPerMinute: number;
    diagnosis?: {
      suggestions: Array<{
        questionId: string;
        category: string;
        reason: string;
      }>;
      note: string;
    };
  };
}
export interface TrainingModePolicy {
  id: ModeId;
  navigation: "forward" | "free";
  confidence: boolean;
  sectional: boolean;
  requiresSubject: boolean;
  supportsFullSection: boolean;
  supportsTier: boolean;
  clock: "fixed" | "target";
  clockMultiplier: number;
  minuteOptions: number[];
  minDifficulty: number;
  lives: number | null;
}

export interface TrainingCapabilities {
  exams: Array<{ id: string; label: string }>;
  modes: Record<string, TrainingModePolicy>;
}

export interface TrainingDashboard {
  readiness: number | null;
  evidenceConfidence?: "low" | "medium" | "high";
  confidenceScore?: number;
  attempts: number;
  evidence: string;
  factors: Record<string, number>;
  weights?: Record<string, number>;
  topics: Array<{
    key: string;
    subject: string;
    topic: string;
    mastery: number;
    attempts: number;
    seconds: number;
  }>;
  reviews: Array<{
    questionId: string;
    topic: string;
    dueAt: string;
    reason: string;
    mistake: string | null;
  }>;
  due: Array<{ questionId: string }>;
  subjects: string[];
  catalogTopics: string[];
  catalog: Array<{ subject: string; topic: string }>;
  active: Array<{ id: string; mode: string; deadline: string }>;
  history: Array<{
    id: string;
    mode: string;
    at: string;
    score: number;
    maxScore: number;
    accuracy: number;
    completionReason?: string;
  }>;
  mission: Array<{ mode: ModeId; count: number; label: string }>;
  personalBest: number;
}

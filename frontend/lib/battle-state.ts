export type BattleAnswer = { type: "mcq"; selectedIndex: number } | { type: "msq"; selectedIndices: number[] } | { type: "nat"; numericAnswer: number };
export type BattleKey = { type: "mcq"; selectedIndex: number } | { type: "msq"; selectedIndices: number[] } | { type: "nat"; min: number; max: number };
export type BattleContent = { type?: "mcq" | "msq" | "nat"; partialCredit?: boolean; questionImage?: string | null; optionImages?: (string | null)[] };
export function battlePicked(answer: BattleAnswer | null | undefined, index: number) {
  return answer?.type === "mcq" ? answer.selectedIndex === index : answer?.type === "msq" ? answer.selectedIndices.includes(index) : false;
}
export function battleKeyIncludes(key: BattleKey | null | undefined, index: number) {
  return key?.type === "mcq" ? key.selectedIndex === index : key?.type === "msq" ? key.selectedIndices.includes(index) : false;
}
export function revealCorrect(reveal: Reveal, userId: string) {
  return reveal.results?.[userId]?.correct ?? (reveal.correctIndex != null && reveal.selections[userId] === reveal.correctIndex);
}
export type BattleQuestion = BattleContent & {
  question: string; options: string[]; questionIndex: number; total: number; deadline: string | null;
};
export type BattleReviewItem = BattleContent & {
  questionIndex: number;
  question: string;
  options: string[];
  correctIndex: number | null; correctAnswer?: BattleKey | null;
  explanation?: string | null;
  myAnswer: {
    selectedIndex: number | null;
    answer?: BattleAnswer | null; points?: number;
    correct: boolean;
    timedOut?: boolean;
  } | null;
  opponentAnswer: {
    selectedIndex: number | null;
    answer?: BattleAnswer | null; points?: number;
    correct: boolean;
    timedOut?: boolean;
  } | null;
};
export type PlayerScore = { name: string; score: number; answered: boolean; connected?: boolean; lastCorrect?: boolean | null };
export type Scores = Record<string, PlayerScore>;
export type Reveal = { questionIndex: number; correctIndex: number | null; correctAnswer?: BattleKey | null; selections: Record<string, number | null>; answers?: Record<string, BattleAnswer | null>; results?: Record<string, { correct: boolean; points: number }>; scores?: Scores; revealEndsAt?: string | null };
export type MatchStats = { correct: number; total: number; accuracy: number; averageResponseMs: number | null; timedOut: number };
export type BattleResult = {
  scores: Scores; finishReason?: "completed" | "forfeit" | "abandoned"; winnerUserId?: string | null;
  loserUserId?: string | null; outcomeReason?: string; responseTimes?: Record<string, number | null>;
  rematchToken?: string | null; opponentName?: string;
  rating?: { lifetime: { before: number; after: number; delta: number }; season: { before: number; after: number; delta: number; tierBefore: string; tierAfter: string } | null } | null;
  matchStats?: { me: MatchStats; opponent: MatchStats };
  review?: BattleReviewItem[];
};
export type BattleSnapshot = BattleResult & {
  mode?: "ranked" | "casual"; origin?: string; rated?: boolean;
  code: string; status: "waiting" | "active" | "finished";
  subject: string; topic: string; questionCount: number;
  players: { userId: string; name: string; connected: boolean }[];
  myAnswered: boolean; myAnswer?: BattleAnswer | null; mySelectedIndex?: number | null; currentQuestion: BattleQuestion | null;
  reveal?: Reveal | null; opponentPresence?: { connected: boolean; reconnectDeadline?: string | null };
};
export type BattleState = {
  phase: "lobby" | "queueing" | "waiting" | "playing" | "finished";
  mode: "ranked" | "casual"; origin: string; queuedAt: string | null; matchmakingRating: number | null;
  code: string; subject: string; topic: string; questionCount: number; players: string[];
  question: BattleQuestion | null; scores: Scores; answer: BattleAnswer | null; selectedIndex: number | null;
  answerStatus: "idle" | "sending" | "accepted"; correct: boolean | null; reveal: Reveal | null;
  result: BattleResult | null; opponentDeadline: string | null; error: string;
};
export const initialBattleState: BattleState = {
  phase: "lobby", code: "", subject: "mathematics", topic: "all", questionCount: 10, players: [],
  mode: "casual", origin: "private", queuedAt: null, matchmakingRating: null,
  question: null, scores: {}, answer: null, selectedIndex: null, answerStatus: "idle", correct: null,
  reveal: null, result: null, opponentDeadline: null, error: "",
};
export type BattleAction =
  | { type: "reset"; error?: string }
  | { type: "error"; message: string }
  | { type: "created"; code: string; playerName?: string; subject?: string; topic?: string; questionCount?: number }
  | { type: "joined"; code?: string; players: string[]; subject?: string; topic?: string; questionCount?: number }
  | { type: "start"; mode?: "ranked" | "casual"; origin?: string }
  | { type: "question"; question: BattleQuestion }
  | { type: "select"; index: number }
  | { type: "submit"; answer: BattleAnswer }
  | { type: "accepted"; questionIndex: number; isCorrect?: boolean }
  | { type: "opponent-answered"; questionIndex: number; userId: string }
  | { type: "queued"; queuedAt: string; rating: number; subject: string; topic: string; questionCount: number }
  | { type: "matched"; code: string }
  | { type: "rejected"; questionIndex?: number; reason: string }
  | { type: "scores"; scores: Scores }
  | { type: "reveal"; reveal: Reveal; userId: string }
  | { type: "end"; result: BattleResult }
  | { type: "resume"; snapshot: BattleSnapshot; userId: string }
  | { type: "presence"; deadline: string | null };

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case "reset": return { ...initialBattleState, error: action.error || "" };
    case "queued": return { ...initialBattleState, phase: "queueing", origin: "matchmaking", queuedAt: action.queuedAt,
      matchmakingRating: action.rating, subject: action.subject, topic: action.topic, questionCount: action.questionCount };
    case "matched": return { ...state, phase: "waiting", code: action.code, queuedAt: null, error: "" };
    case "error": return { ...state, error: action.message };
    case "created": return {
      ...initialBattleState,
      phase: "waiting",
      code: action.code,
      players: action.playerName ? [action.playerName] : [],
      subject: action.subject || state.subject,
      topic: action.topic || state.topic,
      questionCount: action.questionCount || state.questionCount,
    };
    case "joined": return { ...state, phase: "waiting", code: action.code || state.code, players: action.players, subject: action.subject || state.subject, topic: action.topic || state.topic, questionCount: action.questionCount || state.questionCount, error: "" };
    case "start": return { ...state, mode: action.mode || state.mode, origin: action.origin || state.origin, phase: "playing", question: null, scores: {}, error: "", result: null };
    case "question": {
      if (state.phase === "finished" || state.phase === "lobby") return state;
      if (state.question && action.question.questionIndex <= state.question.questionIndex) return state;
      return { ...state, phase: "playing", question: action.question, answer: null, selectedIndex: null, answerStatus: "idle", correct: null, reveal: null, error: "", scores: Object.fromEntries(Object.entries(state.scores).map(([id, p]) => [id, { ...p, answered: false, lastCorrect: null }])) };
    }
    case "submit": return { ...state, answer: action.answer, selectedIndex: action.answer.type === "mcq" ? action.answer.selectedIndex : null, answerStatus: "sending", error: "" };
    case "select": return { ...state, answer: { type: "mcq", selectedIndex: action.index }, selectedIndex: action.index, answerStatus: "sending", error: "" };
    case "accepted": return action.questionIndex !== state.question?.questionIndex ? state : { ...state, correct: null, answerStatus: "accepted", error: "" };
    case "opponent-answered": return action.questionIndex !== state.question?.questionIndex || !state.scores[action.userId] ? state :
      { ...state, scores: { ...state.scores, [action.userId]: { ...state.scores[action.userId], answered: true } } };
    case "rejected": {
      if (action.questionIndex !== undefined && action.questionIndex !== state.question?.questionIndex) return state;
      const locked = ["already-answered", "deadline-expired", "stale-question"].includes(action.reason);
      const message = action.reason === "deadline-expired"
        ? "Time is up. Waiting for the round result."
        : action.reason === "already-answered"
          ? "Your answer is already recorded."
          : action.reason === "invalid-answer-key"
            ? "This question could not be scored. Syncing the match…"
            : action.reason === "server-error"
              ? "The answer service is temporarily unavailable. Syncing the match…"
              : "Answer could not be recorded. Syncing the match…";
      return { ...state, answerStatus: locked ? "accepted" : "idle", answer: locked ? state.answer : null, selectedIndex: locked ? state.selectedIndex : null, error: message };
    }
    case "scores": return { ...state, scores: action.scores };
    case "reveal": return action.reveal.questionIndex !== state.question?.questionIndex ? state : { ...state, reveal: action.reveal, scores: action.reveal.scores ?? state.scores, answer: action.reveal.answers?.[action.userId] ?? state.answer, selectedIndex: action.reveal.selections[action.userId] ?? null, answerStatus: "accepted", correct: revealCorrect(action.reveal, action.userId), error: "" };
    case "end": return { ...state, phase: "finished", result: action.result, scores: action.result.scores, opponentDeadline: null, error: "" };
    case "presence": return { ...state, opponentDeadline: action.deadline };
    case "resume": {
      const s = action.snapshot;
      return { ...initialBattleState, mode: s.mode || "casual", origin: s.origin || "private", code: s.code, phase: s.status === "active" ? "playing" : s.status, subject: s.subject, topic: s.topic, questionCount: s.questionCount, players: s.players.map(p => p.name), question: s.currentQuestion, scores: s.scores, answer: s.myAnswer ?? (s.mySelectedIndex != null ? { type: "mcq", selectedIndex: s.mySelectedIndex } : null), selectedIndex: s.mySelectedIndex ?? null, answerStatus: s.myAnswered ? "accepted" : "idle", correct: s.reveal ? revealCorrect(s.reveal, action.userId) : null, reveal: s.reveal ?? null, result: s.status === "finished" ? s : null, opponentDeadline: s.opponentPresence?.connected === false ? s.opponentPresence.reconnectDeadline || null : null };
    }
  }
}

export function battleOutcome(result: BattleResult, userId: string): "win" | "loss" | "draw" | "abandoned" {
  if (result.finishReason === "abandoned") return "abandoned";
  if (result.winnerUserId) return result.winnerUserId === userId ? "win" : "loss";
  const me = result.scores[userId]?.score ?? 0;
  const opponent = Object.entries(result.scores).find(([id]) => id !== userId)?.[1].score ?? 0;
  return me === opponent ? "draw" : me > opponent ? "win" : "loss";
}

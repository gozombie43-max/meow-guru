"use client";
import BattleQuestionCard from "@/components/battle/BattleQuestionCard";
import QuestionImage from "@/components/QuestionImage";
import { battlePicked, battleKeyIncludes, revealCorrect } from "@/lib/battle-state";


import { useExamMode } from '@/context/ExamModeContext';
import { JAM_SECTIONS, JAM_SUBJECT, jamQuestionTopic } from '@/lib/exam-mode';
import { Dialog } from "@/components/ui/Dialog";
import RichContent from "@/components/RichContent";
import { useAuth } from "@/context/AuthContext";
import { useBattle } from "@/hooks/useBattle";
import { useThemeMode } from "@/hooks/useTheme";
import "@/features/quiz/components/views/mobile-quiz-view.css";
import { battleOutcome, type BattleReviewItem, type PlayerScore, type Reveal } from "@/lib/battle-state";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, CheckCheck, Copy, FileText, LoaderCircle, LogOut, Mail, Minus, RotateCcw, Shield, Swords, Trophy, Users, Wifi, WifiOff, X, Zap } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import useSWR from 'swr';
import api from '@/shared/api/client';

const validRoomCode = (value: string) => /^(?:[A-Z2-9]{6}|\d{4})$/.test(value);
const cleanRoomCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

const SUBJECTS = [
  { value: "mathematics", label: "Mathematics" }, { value: "reasoning", label: "Reasoning" },
  { value: "english", label: "English" }, { value: "general-awareness", label: "General Awareness" },
] as const;
const TOPICS: Record<string, { value: string; label: string }[]> = {
  mathematics: [
    { value: "all", label: "All topics" }, { value: "trigonometry", label: "Trigonometry" },
    { value: "algebra", label: "Algebra" }, { value: "geometry", label: "Geometry" },
    { value: "mensuration", label: "Mensuration" }, { value: "percentages", label: "Percentages" },
  ],
  reasoning: [{ value: "all", label: "All topics" }], english: [{ value: "all", label: "All topics" }],
  "general-awareness": [{ value: "all", label: "All topics" }],
};
const QUESTION_COUNTS = [10, 15, 25, 50] as const;
const CONFETTI = Array.from({ length: 24 }, (_, index) => ({
  id: index, left: (index * 37 + 11) % 100, delay: (index % 8) * 0.09,
  duration: 2.25 + (index % 5) * 0.16,
  color: ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ec4899"][index % 5],
}));

type Connection = "connecting" | "syncing" | "online" | "offline";

function ConnectionStatus({ status, compact = false }: { status: Connection; compact?: boolean }) {
  const online = status === "online";
  return <span className={`battle-connection ${online ? "is-online" : ""} ${compact ? "is-compact" : ""}`} aria-live="polite">
    {compact ? <span className="battle-connection-dot" aria-hidden="true" /> : online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
    {online ? "Live" : status === "offline" ? "Offline" : "Syncing"}
  </span>;
}

function BattleHeader({ title, status, backHref = "/", onBack }: { title: string; status: Connection; backHref?: string; onBack?: () => void }) {
  return <header data-ui-chrome="header" className="battle-header"><div className="battle-header-inner">
    {onBack ? <button data-ui-button="icon" type="button" className="battle-icon-button" aria-label="Go back" onClick={onBack}><ArrowLeft /></button> : <Link replace data-ui-button="secondary" href={backHref} className="battle-icon-button" aria-label="Go back"><ArrowLeft /></Link>}
    <div className="battle-header-copy"><strong>{title}</strong></div>
    <ConnectionStatus status={status} />
  </div></header>;
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return <div className="battle-notice is-error" role="alert"><span>{message}</span>{onRetry && <button data-ui-button="state" type="button" onClick={onRetry}>Reconnect</button>}</div>;
}

function RoundCenterBadge({ reveal }: { reveal: Reveal | null }) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (!reveal) return;

    const revealEndTime = reveal.revealEndsAt
      ? new Date(reveal.revealEndsAt).getTime()
      : Date.now() + 5000;

    const updateTimer = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, revealEndTime - now);
      const secs = Math.ceil(remainingMs / 1000);
      setSecondsLeft(secs);
    };

    const initialTimer = window.setTimeout(updateTimer, 0);
    const interval = window.setInterval(updateTimer, 250);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [reveal]);

  if (!reveal) {
    return <span className="battle-round-center" aria-label="Versus">VS</span>;
  }

  return (
    <span className="battle-round-center is-reveal" role="timer" aria-label={`Next question in ${secondsLeft} seconds`}>
      {secondsLeft}s
    </span>
  );
}

function BattleRoundResult({ reveal, userId }: { reveal: Reveal; userId: string }) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !reveal.revealEndsAt || new Date(reveal.revealEndsAt).getTime() > Date.now());
  const mineCorrect = revealCorrect(reveal, userId);
  const opponentId = Object.keys(reveal.selections).find(id => id !== userId);
  const opponentCorrect = opponentId ? revealCorrect(reveal, opponentId) : false;
  const result = mineCorrect ? (opponentCorrect ? "both-correct" : "won") : (opponentCorrect ? "lost" : "both-missed");
  const partial = reveal.results?.[userId]?.points;
  const label = partial && partial < 10 ? `Partial credit · +${partial}` : { won: "Round won", "both-correct": "Both correct", lost: "Round lost", "both-missed": "Both missed" }[result];
  const Icon = { won: Check, "both-correct": CheckCheck, lost: X, "both-missed": Minus }[result];

  useEffect(() => {
    // Enter for 200ms, hold for 1400ms, then exit for 160ms. A resumed
    // round must dismiss before its server-controlled reveal window ends.
    const delay = reveal.revealEndsAt
      ? Math.max(0, Math.min(1600, new Date(reveal.revealEndsAt).getTime() - Date.now() - 160))
      : 1600;
    const timer = window.setTimeout(() => setVisible(false), delay);
    return () => window.clearTimeout(timer);
  }, [reveal.revealEndsAt]);

  return <AnimatePresence>
      {visible && <motion.div
        className="battle-result-pill"
        data-result={result}
        initial={reduceMotion ? false : { y: 12, opacity: 0, scale: .97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { y: 6, opacity: 0, scale: .98, transition: { duration: .16, ease: [.2, .8, .2, 1] } }}
        transition={{ type: "tween", duration: reduceMotion ? 0 : .2, ease: [.2, .8, .2, 1] }}
      >
        <span className="battle-result-pill-icon" aria-hidden="true"><Icon /></span>
        <span>{label}</span>
      </motion.div>}
  </AnimatePresence>;
}

function BattleReviewSection({ review, opponentName }: { review?: BattleReviewItem[]; opponentName?: string }) {
  const [filter, setFilter] = useState<"all" | "correct" | "wrong">("all");
  if (!review || review.length === 0) {
    return (
      <div className="battle-review-empty">
        <p>No questions were completed to review for this duel.</p>
      </div>
    );
  }

  const filtered = review.filter((item) => {
    if (filter === "correct") return item.myAnswer?.correct === true;
    if (filter === "wrong") return item.myAnswer?.correct === false || !item.myAnswer;
    return true;
  });

  return (
    <section className="battle-review-panel" aria-label="Question interactions review">
      <div className="battle-review-header">
        <div>
          <p className="battle-kicker">Match review</p>
          <h2>Question by question breakdown</h2>
        </div>
        <div className="battle-review-tabs" role="tablist" aria-label="Review filter">
          <button data-ui-button="state"
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={filter === "all" ? "is-active" : ""}
            onClick={() => setFilter("all")}
          >
            All ({review.length})
          </button>
          <button data-ui-button="state"
            type="button"
            role="tab"
            aria-selected={filter === "correct"}
            className={filter === "correct" ? "is-active" : ""}
            onClick={() => setFilter("correct")}
          >
            Correct
          </button>
          <button data-ui-button="state"
            type="button"
            role="tab"
            aria-selected={filter === "wrong"}
            className={filter === "wrong" ? "is-active" : ""}
            onClick={() => setFilter("wrong")}
          >
            Mistakes
          </button>
        </div>
      </div>

      <div className="battle-review-list">
        {filtered.map((item) => {
          const mySelected = item.myAnswer?.selectedIndex ?? null;
          const oppSelected = item.opponentAnswer?.selectedIndex ?? null;

          return (
            <div key={item.questionIndex} className="battle-review-card">
              <div className="battle-review-card-meta">
                <span className="battle-review-qnum">Question {item.questionIndex + 1}</span>
                <span className={`battle-review-pill ${item.myAnswer?.correct ? "is-correct" : "is-wrong"}`}>
                  {item.myAnswer?.points ? `You scored (+${item.myAnswer.points})` : item.myAnswer?.correct ? "You scored (+10)" : item.myAnswer ? "You missed" : "Unanswered"}
                </span>
                {item.opponentAnswer?.correct && (
                  <span className="battle-review-pill is-opp-correct">Opponent scored (+10)</span>
                )}
              </div>

              <div className="battle-review-question">
                <RichContent text={item.question} />
                {item.questionImage && !item.question.includes(item.questionImage) && <QuestionImage src={item.questionImage} alt="Question diagram" />}
              </div>

              <div className="battle-review-options">
                {item.options.map((option, optIdx) => {
                  const isCorrectAnswer = item.correctAnswer ? battleKeyIncludes(item.correctAnswer, optIdx) : item.correctIndex === optIdx;
                  const isMyPick = item.myAnswer?.answer ? battlePicked(item.myAnswer.answer, optIdx) : mySelected === optIdx;
                  const isOppPick = item.opponentAnswer?.answer ? battlePicked(item.opponentAnswer.answer, optIdx) : oppSelected === optIdx;

                  let optClass = "battle-review-opt";
                  if (isCorrectAnswer) optClass += " is-correct-answer";
                  if (isMyPick && !isCorrectAnswer) optClass += " is-my-wrong";

                  return (
                    <div key={optIdx} className={optClass}>
                      <span className="battle-review-opt-label">{String.fromCharCode(65 + optIdx)}</span>
                      <div className="battle-review-opt-text"><RichContent text={option} />{item.optionImages?.[optIdx] && !option.includes(item.optionImages[optIdx]!) && <QuestionImage src={item.optionImages[optIdx]!} alt={`Option ${String.fromCharCode(65 + optIdx)} diagram`} />}</div>
                      <div className="battle-review-opt-badges">
                        {isCorrectAnswer && <span className="battle-badge-correct"><Check /> Right Answer</span>}
                        {isMyPick && (
                          <span className={`battle-badge-user is-me ${item.myAnswer?.correct ? "is-win" : "is-loss"}`}>
                            You chose {item.myAnswer?.correct ? "✓" : "✗"}
                          </span>
                        )}
                        {isOppPick && (
                          <span className={`battle-badge-user is-opp ${item.opponentAnswer?.correct ? "is-win" : "is-loss"}`}>
                            {opponentName || "Opponent"} chose {item.opponentAnswer?.correct ? "✓" : "✗"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {item.correctAnswer?.type === "nat" && <div className="battle-review-explanation">
                <p>Accepted answer: {item.correctAnswer.min === item.correctAnswer.max ? item.correctAnswer.min : `${item.correctAnswer.min} to ${item.correctAnswer.max}`}</p>
                <p>You: {item.myAnswer?.answer?.type === "nat" ? item.myAnswer.answer.numericAnswer : "Unanswered"}</p>
                <p>Opponent: {item.opponentAnswer?.answer?.type === "nat" ? item.opponentAnswer.answer.numericAnswer : "Unanswered"}</p>
              </div>}
              {item.explanation && (
                <div className="battle-review-explanation">
                  <strong>Explanation:</strong>
                  <RichContent text={item.explanation} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlayerBlock({ player, fallback, side }: { player?: PlayerScore; fallback: string; side: "me" | "opponent" }) {
  const name = player?.name || fallback;
  return <div className={`battle-player is-${side}`}>
    <span className="battle-avatar" aria-hidden="true">{name.charAt(0).toUpperCase() || "?"}</span>
    <span className="battle-player-copy"><strong title={name}>{name}</strong><small>{player?.answered ? "Answer locked" : side === "me" ? "Choosing" : "Thinking…"}</small></span>
    <b>{player?.score ?? 0}</b>
  </div>;
}

function Confetti() {
  return <div className="battle-confetti" aria-hidden="true">{CONFETTI.map((piece) => <motion.i key={piece.id}
    style={{ left: `${piece.left}%`, background: piece.color }} initial={{ y: -20, rotate: 0, opacity: 1 }}
    animate={{ y: "110dvh", rotate: 640, opacity: [1, 1, 0] }} transition={{ duration: piece.duration, delay: piece.delay, ease: "easeIn" }} />)}</div>;
}

function BattlePageContent() {
  const { user, token, loading } = useAuth();
  const { theme } = useThemeMode();
  const searchParams = useSearchParams();
  const battle = useBattle(token, user?.id || "");
  const { data: capabilities, error: capabilitiesError, mutate: refreshCapabilities } = useSWR<{ matchmaking: boolean; ranked: boolean; socialChallenges: boolean }>(user && token ? ['battle-capabilities', user.id] : null,
    async () => (await api.get('/api/battle/capabilities')).data);
  const { state, connection, pending, inviteStatus } = battle;
  const { isJam } = useExamMode();
  const [sscSubject, setSubject] = useState("mathematics");
  const subject = isJam ? JAM_SUBJECT : sscSubject;
  const subjects = isJam ? [{ value: JAM_SUBJECT, label: "IIT JAM Physics" }] : SUBJECTS;
  const [topic, setTopic] = useState("all");
  const [prevIsJam, setPrevIsJam] = useState(isJam);
  if (prevIsJam !== isJam) {
    setPrevIsJam(isJam);
    setTopic("all");
  }
  const [questionCount, setQuestionCount] = useState(10);
  const [modeOverride, setModeOverride] = useState<"quick" | "create" | "join" | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const invitationCode = cleanRoomCode(searchParams.get("join") || '');
  const mode = modeOverride || (validRoomCode(invitationCode) ? "join" : "quick");
  const effectiveJoinCode = joinCode ?? invitationCode;
  const effectivePlayerName = user?.name || user?.email?.split("@")[0] || "Player";
  const players = useMemo(() => Object.entries(state.scores), [state.scores]);
  const me = players.find(([id]) => id === user?.id)?.[1];
  const opponentEntry = players.find(([id]) => id !== user?.id);
  const opponent = opponentEntry?.[1];
  const canSend = connection === "online" && !pending;
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(state.code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { /* The selectable code remains available when clipboard access is denied. */ }
  };

  if (loading) return <main className="battle-centered"><LoaderCircle className="battle-spinner" /><p>Preparing the arena…</p></main>;
  if (!user || !token) return <main className="battle-page"><BattleHeader title="1v1 Battle" status="offline" /><section className="battle-auth-card">
    <span className="battle-hero-icon"><Shield /></span><p className="battle-kicker">Members only</p><h1>Sign in to enter the arena</h1>
    <p>Your battle rating, results, and reconnect protection are linked to your account.</p><Link data-ui-button="primary" className="battle-primary-button" href="/login">Sign in to battle</Link>
  </section></main>;

  if (state.phase === "lobby") {
    const topicOptions = isJam ? [{ value: "all", label: "All Physics sections" }, ...JAM_SECTIONS.map(s => ({ value: jamQuestionTopic(s.slug), label: s.title }))] : TOPICS[subject] || TOPICS.mathematics;
    const submit = () => {
      if (!effectivePlayerName.trim()) return;
      if (mode === 'quick') battle.matchmake({ subject, topic, questionCount });
      else if (mode === "create") battle.create({ playerName: effectivePlayerName.trim(), subject, topic, questionCount });
      else if (validRoomCode(effectiveJoinCode)) battle.join(effectiveJoinCode, effectivePlayerName.trim());
    };
    return <main className="battle-page"><BattleHeader title="1v1 Battle" status={connection} /><div className="battle-lobby-shell">
      <section className="battle-intro"><span className="battle-hero-icon"><Swords /></span><p className="battle-kicker">Real-time quiz duel</p>
        <h1>Think fast.<br />Win the round.</h1><p>Find an opponent with Quick Match, challenge a friend, or share a private room. Both players answer the same questions.</p>
        <div className="battle-trust-row"><span><Zap /> Quick Match</span><span><Shield /> Reconnect safe</span><span><Trophy /> {capabilities?.ranked ? 'Ranked matchmaking' : 'Casual battles'}</span></div>
      </section>
      <section className="battle-setup-card" aria-labelledby="setup-title"><div className="battle-card-heading"><Users aria-hidden="true" /><h2 id="setup-title">Start a battle</h2><select className="battle-question-count" aria-label="Question count" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))}>{QUESTION_COUNTS.map(count => <option key={count} value={count}>{count} Qs</option>)}</select></div>
        <div className="battle-tabs" role="tablist" aria-label="Battle mode">{([['quick', 'Quick Match'], ['create', 'Private room'], ['join', 'Join room']] as const).map(([value, label]) => <button key={value} data-ui-button="state" type="button" role="tab" aria-selected={mode === value} className={mode === value ? 'is-active' : ''} onClick={() => setModeOverride(value)}>{label}</button>)}</div>
        {mode !== "join" ? <><div className="battle-field-grid"><label className="battle-field"><span>Subject</span><select value={subject} onChange={(event) => { setSubject(event.target.value); setTopic("all"); }}>{subjects.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="battle-field"><span>Topic</span><select value={topic} onChange={(event) => setTopic(event.target.value)}>{topicOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
</>
          : <label className="battle-field battle-code-field"><span>Room code</span><input value={effectiveJoinCode} onChange={(event) => setJoinCode(cleanRoomCode(event.target.value))} placeholder="7K4P9Q" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={6} aria-label="Room code"/></label>}
        <ErrorNotice message={state.error || (mode === "quick" && capabilitiesError ? "Could not load Quick Match availability. Please retry." : "")} onRetry={connection === "offline" ? battle.reconnect : undefined} />{mode === "quick" && capabilitiesError && <button data-ui-button="state" type="button" className="battle-text-button" onClick={() => void refreshCapabilities()}>Retry availability</button>}
        <button data-ui-button="primary" type="button" className="battle-primary-button" disabled={!canSend || !effectivePlayerName.trim() || (mode === "join" && !validRoomCode(effectiveJoinCode)) || (mode === "quick" && !capabilities?.matchmaking)} onClick={submit}>{pending ? <LoaderCircle className="battle-spinner" /> : <Swords />}{pending === "matchmaking" ? "Joining matchmaking…" : pending === "create" ? "Creating room…" : pending === "join" ? "Joining room…" : mode === "quick" ? (!capabilities ? "Checking availability…" : "Find an opponent") : mode === "create" ? "Create private room" : "Join battle"}</button>
        <p className="battle-helper">{mode === "quick" ? (!capabilities ? "Checking battle availability…" : capabilities.ranked ? "Ranked · Balanced questions · Similar ratings" : "Casual matchmaking · Ratings are paused") : "Casual battle · Ratings do not change"}</p>{capabilities?.socialChallenges && <Link href="/battle/social" className="battle-friend-link">Challenge a friend <span>Casual</span></Link>}
      </section>
    </div></main>;
  }

  if (state.phase === 'queueing' || (state.phase === 'waiting' && state.origin === 'matchmaking')) return <main className="battle-page battle-waiting-page">
    <BattleHeader title="Quick Match" status={connection} onBack={state.phase === 'queueing' ? battle.cancelMatchmaking : battle.leave} />
    <section className="battle-waiting-card">
      <LoaderCircle className="battle-spinner" aria-hidden="true" /><p className="battle-kicker">{capabilities?.ranked ? 'Ranked matchmaking' : 'Casual matchmaking'}</p>
      <h1>{state.phase === 'queueing' ? 'Finding an opponent' : 'Opponent found'}</h1>
      <p role="status">{state.phase === 'queueing' ? 'Looking for a player near your rating. Your match starts when both players are ready.' : 'Connecting both players to the match…'}</p>
      {state.matchmakingRating !== null && <p>Your rating: {state.matchmakingRating}</p>}
      <ErrorNotice message={state.error} onRetry={connection === 'offline' ? battle.reconnect : undefined} />
      <button data-ui-button="secondary" type="button" className="battle-secondary-button" disabled={!canSend} onClick={state.phase === 'queueing' ? battle.cancelMatchmaking : battle.leave}>{pending === 'cancel-matchmaking' || pending === 'leave' ? 'Cancelling…' : 'Cancel'}</button>
    </section>
  </main>;

  if (state.phase === "waiting") return <main className="battle-page battle-waiting-page"><BattleHeader title="Waiting room" status={connection} onBack={battle.leave} /><section className="battle-waiting-card">
    <div className="battle-pulse"><Swords /></div><p className="battle-kicker">Room ready</p><h1>Invite your opponent</h1><p>The battle will begin as soon as a second player joins.</p>
    <button data-ui-button="state" type="button" className="battle-room-code" onClick={copyCode} aria-label="Copy room code"><small>Room code</small><strong>{state.code}</strong><span>{copied ? <><Check /> Copied</> : <><Copy /> Copy</>}</span></button>
    <div className="battle-versus-row"><div><span>{state.players[0]?.charAt(0).toUpperCase() || "?"}</span><b>{state.players[0] || effectivePlayerName}</b><small>Ready</small></div><i>VS</i><div className="is-empty"><span>?</span><b>{state.players[1] || "Opponent"}</b><small>{state.players[1] ? "Joining…" : "Waiting…"}</small></div></div>
    <form className="battle-invite" onSubmit={(event) => { event.preventDefault(); if (inviteEmail.trim()) battle.invite(inviteEmail.trim()); }}><label htmlFor="battle-email">Invite by email</label><div><Mail /><input id="battle-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="friend@example.com"  aria-label="friend@example.com"/><button data-ui-button="state" disabled={!canSend || !inviteEmail.trim()}>{pending === "invite" ? "Sending…" : "Send"}</button></div>{inviteStatus && <p className={inviteStatus.ok ? "is-success" : "is-error"}>{inviteStatus.message}</p>}</form>
    <ErrorNotice message={state.error} onRetry={connection === "offline" ? battle.reconnect : undefined} /><button data-ui-button="state" type="button" className="battle-text-button" disabled={pending === "leave"} onClick={battle.leave}>{pending === "leave" ? "Cancelling…" : "Cancel room"}</button>
  </section></main>;

  if (state.phase === "playing") {
    if (!state.question) return <main className="battle-centered"><LoaderCircle className="battle-spinner" /><p>Loading the first question…</p></main>;
    const q = state.question;
    return <main className="battle-game-shell ios-series-quiz" data-theme={theme} data-text-size="md" data-text-weight="medium">
      <header className="battle-score-header" aria-label="Battle progress and scores">
        <div className="battle-score-meta">
            <button data-ui-button="state"
              type="button"
              className="battle-exit-button"
              onClick={() => setShowExitModal(true)}
              aria-label="Exit quiz"
            >
              <ArrowLeft aria-hidden="true" />
              <span>Exit</span>
            </button>
            <div className="battle-meta-counter" aria-label={`Question ${q.questionIndex + 1} of ${q.total}`}>
              <span>Question</span><strong>{q.questionIndex + 1} / {q.total}</strong>
            </div>
          <ConnectionStatus status={connection} compact />
        </div>
        <div className="battle-round-progress" role="progressbar" aria-label="Question progress" aria-valuemin={0} aria-valuemax={q.total} aria-valuenow={q.questionIndex + 1}>
          <i style={{ width: `${((q.questionIndex + 1) / q.total) * 100}%` }} />
        </div>
        <div className="battle-score-grid">
          <PlayerBlock player={me} fallback={effectivePlayerName} side="me" />
          <RoundCenterBadge reveal={state.reveal} />
          <PlayerBlock player={opponent} fallback="Opponent" side="opponent" />
        </div>
      </header>

      <div className="battle-game-scroll">
        <div className="battle-question-wrap">
          {state.opponentDeadline && (
            <div className="battle-notice">
              <span>Opponent disconnected. Their reconnect window is still open.</span>
            </div>
          )}
          <BattleQuestionCard key={`${state.code}-${q.questionIndex}`} question={q} answer={state.answer} reveal={state.reveal}
            userId={user.id} disabled={state.answerStatus !== "idle" || connection !== "online"} onSubmit={battle.submitAnswer} />

          {!state.reveal && <div className="battle-answer-status" aria-live="polite">
            {state.answerStatus !== "idle" ? (
              <>
                <LoaderCircle className="battle-spinner" />
                <span>Your answer is locked. Waiting for your opponent…</span>
              </>
            ) : connection !== "online" ? (
              <>
                <WifiOff />
                <span>Reconnecting before you can answer…</span>
              </>
            ) : (
              <span>Choose your answer.</span>
            )}
          </div>}
          <ErrorNotice message={state.error} onRetry={connection === "offline" ? battle.reconnect : undefined} />
        </div>
      </div>

      <div className="battle-result-hud" role="status" aria-live="polite" aria-atomic="true">
        {state.reveal && <BattleRoundResult key={`${state.code}-${q.questionIndex}`} reveal={state.reveal} userId={user.id} />}
      </div>

      {showExitModal && (
        <Dialog onClose={() => setShowExitModal(false)} busy={pending === "forfeit"} className="battle-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="exit-modal-title">
          <div className="battle-modal-card">
            <div className="battle-modal-icon is-danger"><AlertTriangle /></div>
            <h2 id="exit-modal-title">Exit Battle?</h2>
            <p>If you exit now, you will forfeit this duel and your opponent will <strong>automatically win immediately</strong>.</p>
            <div className="battle-modal-actions">
              <button data-ui-button="secondary" type="button" className="battle-secondary-button" onClick={() => setShowExitModal(false)}>
                Keep Playing
              </button>
              <button data-ui-button="danger"
                type="button"
                className="battle-danger-button"
                disabled={pending === "forfeit"}
                onClick={() => {
                  setShowExitModal(false);
                  battle.forfeit();
                }}
              >
                {pending === "forfeit" ? <LoaderCircle className="battle-spinner" /> : <LogOut />}
                {pending === "forfeit" ? "Exiting…" : "Forfeit & Exit"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </main>;
  }

  const result = state.result;
  if (!result) return null;
  const outcome = battleOutcome(result, user.id);
  const resultPlayers = Object.entries(result.scores).sort(([, left], [, right]) => right.score - left.score);
  const rating = result.rating;
  const title = outcome === "win" ? "Victory" : outcome === "loss" ? "Good battle" : outcome === "draw" ? "Draw match" : "Battle ended";
  return <main className={`battle-page battle-result-page is-${outcome}`}>
    {outcome === "win" && <Confetti />}
    <BattleHeader title="Match result" status={connection} onBack={battle.reset} />
    <section className="battle-result-shell">
      <div className="battle-result-hero">
        <span>{outcome === "win" ? <Trophy /> : outcome === "draw" ? <Swords /> : <Shield />}</span>
        <p className="battle-kicker">{result.finishReason === "forfeit" ? "Finished by forfeit" : "Final result"}</p>
        <h1>{title}</h1>
        {result.outcomeReason === "response-time" && <p>Scores tied. Total response time decided the match.</p>}
        <p>{outcome === "win" ? (result.finishReason === "forfeit" ? "Opponent forfeited the duel — instant victory!" : "Sharp answers and steady timing.") : outcome === "loss" ? (result.finishReason === "forfeit" ? "Duel ended by forfeit." : "Review the result, then run it back.") : outcome === "draw" ? "Nothing separated you this time." : "The match could not be completed."}</p>
      </div>
      <div className="battle-final-scores">
        {resultPlayers.map(([id, player], index) => (
          <div key={id} className={id === user.id ? "is-me" : ""}>
            <span>{index + 1}</span>
            <i>{player.name.charAt(0).toUpperCase()}</i>
            <p><b>{player.name}</b><small>{id === user.id ? "You" : "Opponent"}</small></p>
            <strong>{player.score}<small> pts</small></strong>
          </div>
        ))}
      </div>
      {rating && (
        <section className="battle-result-panel">
          <div><p className="battle-kicker">Rating update</p><h2>{rating.season?.tierAfter || "Lifetime rating"}</h2></div>
          <strong>{rating.season?.after ?? rating.lifetime.after}<small className={(rating.season?.delta ?? rating.lifetime.delta) >= 0 ? "is-positive" : "is-negative"}>{(rating.season?.delta ?? rating.lifetime.delta) >= 0 ? "+" : ""}{rating.season?.delta ?? rating.lifetime.delta}</small></strong>
        </section>
      )}
      {result.matchStats && (
        <section className="battle-stats-panel">
          <h2>Match breakdown</h2>
          <div>
            <article>
              <span>You</span>
              <strong>{result.matchStats.me.accuracy}%</strong>
              <small>{result.matchStats.me.correct}/{result.matchStats.me.total} correct</small>
            </article>
            <article>
              <span>Opponent</span>
              <strong>{result.matchStats.opponent.accuracy}%</strong>
              <small>{result.matchStats.opponent.correct}/{result.matchStats.opponent.total} correct</small>
            </article>
          </div>
        </section>
      )}

      {showReview && (
        <BattleReviewSection review={result.review} opponentName={result.opponentName} />
      )}

      <ErrorNotice message={state.error} onRetry={connection === "offline" ? battle.reconnect : undefined} />
      <div className="battle-result-actions">
        <button data-ui-button="state"
          type="button"
          className="battle-secondary-button battle-review-toggle"
          onClick={() => setShowReview((prev) => !prev)}
        >
          <FileText /> {showReview ? "Hide Question Review" : "Review All Question Interactions"}
        </button>
        {result.rematchToken && (
          <button data-ui-button="primary" type="button" className="battle-primary-button" disabled={!canSend} onClick={() => battle.rematch(effectivePlayerName)}>
            {pending === "rematch" ? <LoaderCircle className="battle-spinner" /> : <RotateCcw />}
            {pending === "rematch" ? "Sending rematch…" : `Rematch ${result.opponentName || "opponent"}`}
          </button>
        )}
        <button data-ui-button="secondary" type="button" className="battle-secondary-button" onClick={battle.reset}>
          <Swords /> New battle
        </button>
        <Link href="/" className="battle-text-link">Return home</Link>
      </div>
    </section>
  </main>;
}

export default function BattlePage() {
  return <Suspense fallback={<main className="battle-centered"><LoaderCircle className="battle-spinner" /><p>Preparing the arena…</p></main>}><BattlePageContent /></Suspense>;
}

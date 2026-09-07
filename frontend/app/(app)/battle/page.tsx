"use client";

import RichContent from "@/components/RichContent";
import { useAuth } from "@/context/AuthContext";
import { useBattle } from "@/hooks/useBattle";
import { battleOutcome, type PlayerScore } from "@/lib/battle-state";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Copy, Crown, LoaderCircle, Mail, RotateCcw, Shield, Swords, Trophy, Users, Wifi, WifiOff, Zap } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

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

function ConnectionStatus({ status }: { status: Connection }) {
  const online = status === "online";
  return <span className={`battle-connection ${online ? "is-online" : ""}`} aria-live="polite">
    {online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
    {online ? "Live" : status === "offline" ? "Offline" : "Syncing"}
  </span>;
}

function BattleHeader({ title, status, backHref = "/", onBack }: { title: string; status: Connection; backHref?: string; onBack?: () => void }) {
  return <header className="battle-header"><div className="battle-header-inner">
    {onBack ? <button type="button" className="battle-icon-button" aria-label="Go back" onClick={onBack}><ArrowLeft /></button> : <Link href={backHref} className="battle-icon-button" aria-label="Go back"><ArrowLeft /></Link>}
    <div className="battle-header-copy"><span className="battle-eyebrow">Battle arena</span><strong>{title}</strong></div>
    <ConnectionStatus status={status} />
  </div></header>;
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return <div className="battle-notice is-error" role="alert"><span>{message}</span>{onRetry && <button type="button" onClick={onRetry}>Reconnect</button>}</div>;
}

function RoundTimer({ deadline, onExpire }: { deadline: string | null; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const reportedDeadline = useRef<string | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  const remaining = deadline ? Math.max(0, new Date(deadline).getTime() - now) : 0;
  const seconds = Math.ceil(remaining / 1000);
  const progress = Math.min(100, (remaining / 30_000) * 100);
  useEffect(() => {
    if (deadline && remaining === 0 && reportedDeadline.current !== deadline) {
      reportedDeadline.current = deadline;
      onExpireRef.current();
    }
  }, [deadline, remaining]);
  return <div className={`battle-timer ${seconds <= 5 ? "is-urgent" : ""}`} aria-label={`${seconds} seconds remaining`}>
    <span>{seconds}</span><svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="18" /><circle cx="21" cy="21" r="18" pathLength="100" style={{ strokeDasharray: `${progress} 100` }} /></svg>
  </div>;
}

function PlayerBlock({ player, fallback, side }: { player?: PlayerScore; fallback: string; side: "me" | "opponent" }) {
  const name = player?.name || fallback;
  return <div className={`battle-player is-${side}`}>
    <span className="battle-avatar">{name.charAt(0).toUpperCase() || "?"}</span>
    <span className="battle-player-copy"><strong>{name}</strong><small>{player?.answered ? "Answer locked" : side === "me" ? "Choose your answer" : "Thinking…"}</small></span>
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
  const searchParams = useSearchParams();
  const battle = useBattle(token, user?.id || "");
  const { state, connection, pending, inviteStatus } = battle;
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [subject, setSubject] = useState("mathematics");
  const [topic, setTopic] = useState("all");
  const [questionCount, setQuestionCount] = useState(10);
  const [modeOverride, setModeOverride] = useState<"create" | "join" | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [expiredQuestionIndex, setExpiredQuestionIndex] = useState<number | null>(null);

  const invitationCode = searchParams.get("join")?.replace(/\D/g, "").slice(0, 4) || "";
  const mode = modeOverride || (invitationCode.length === 4 ? "join" : "create");
  const effectiveJoinCode = joinCode ?? invitationCode;
  const effectivePlayerName = playerName ?? user?.name ?? "";
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
    <p>Your battle rating, results, and reconnect protection are linked to your account.</p><Link className="battle-primary-button" href="/login">Sign in to battle</Link>
  </section></main>;

  if (state.phase === "lobby") {
    const topicOptions = TOPICS[subject] || TOPICS.mathematics;
    const submit = () => {
      if (!effectivePlayerName.trim()) return;
      if (mode === "create") battle.create({ playerName: effectivePlayerName.trim(), subject, topic, questionCount });
      else if (/^\d{4}$/.test(effectiveJoinCode)) battle.join(effectiveJoinCode, effectivePlayerName.trim());
    };
    return <main className="battle-page"><BattleHeader title="1v1 Battle" status={connection} /><div className="battle-lobby-shell">
      <section className="battle-intro"><span className="battle-hero-icon"><Swords /></span><p className="battle-kicker">Real-time quiz duel</p>
        <h1>Think fast.<br />Win the round.</h1><p>Create a private room or enter a four-digit invite code. Both players answer the same timed questions.</p>
        <div className="battle-trust-row"><span><Zap /> 30 sec rounds</span><span><Shield /> Reconnect safe</span><span><Trophy /> Ranked results</span></div>
      </section>
      <section className="battle-setup-card" aria-labelledby="setup-title"><div className="battle-card-heading"><div><p className="battle-kicker">Match setup</p><h2 id="setup-title">Start a battle</h2></div><Users aria-hidden="true" /></div>
        <div className="battle-tabs" role="tablist" aria-label="Battle mode"><button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "is-active" : ""} onClick={() => setModeOverride("create")}>Create room</button><button type="button" role="tab" aria-selected={mode === "join"} className={mode === "join" ? "is-active" : ""} onClick={() => setModeOverride("join")}>Join room</button></div>
        <label className="battle-field"><span>Display name</span><input value={effectivePlayerName} maxLength={40} onChange={(event) => setPlayerName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>
        {mode === "create" ? <><div className="battle-field-grid"><label className="battle-field"><span>Subject</span><select value={subject} onChange={(event) => { setSubject(event.target.value); setTopic("all"); }}>{SUBJECTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="battle-field"><span>Topic</span><select value={topic} onChange={(event) => setTopic(event.target.value)}>{topicOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
          <fieldset className="battle-count-field"><legend>Questions</legend><div>{QUESTION_COUNTS.map((count) => <button type="button" key={count} className={questionCount === count ? "is-active" : ""} onClick={() => setQuestionCount(count)}>{count}</button>)}</div></fieldset></>
          : <label className="battle-field battle-code-field"><span>Room code</span><input value={effectiveJoinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" inputMode="numeric" autoComplete="one-time-code" maxLength={4} /></label>}
        <ErrorNotice message={state.error} onRetry={connection === "offline" ? battle.reconnect : undefined} />
        <button type="button" className="battle-primary-button" disabled={!canSend || !effectivePlayerName.trim() || (mode === "join" && effectiveJoinCode.length !== 4)} onClick={submit}>{pending ? <LoaderCircle className="battle-spinner" /> : <Swords />}{pending === "create" ? "Creating room…" : pending === "join" ? "Joining room…" : mode === "create" ? "Create battle room" : "Join battle"}</button>
        <p className="battle-helper">The match starts automatically when both players are ready.</p>
      </section>
      <nav className="battle-quick-links" aria-label="Battle features"><Link href="/battle/profile"><Crown /><span><b>Profile</b><small>Rating and record</small></span></Link><Link href="/battle/leaderboard"><Trophy /><span><b>Leaderboard</b><small>Top contenders</small></span></Link><Link href="/battle/missions"><Zap /><span><b>Missions</b><small>Earn battle XP</small></span></Link><Link href="/battle/social"><Users /><span><b>Social</b><small>Friends and rivals</small></span></Link></nav>
    </div></main>;
  }

  if (state.phase === "waiting") return <main className="battle-page battle-waiting-page"><BattleHeader title="Waiting room" status={connection} onBack={battle.leave} /><section className="battle-waiting-card">
    <div className="battle-pulse"><Swords /></div><p className="battle-kicker">Room ready</p><h1>Invite your opponent</h1><p>The battle will begin as soon as a second player joins.</p>
    <button type="button" className="battle-room-code" onClick={copyCode} aria-label="Copy room code"><small>Room code</small><strong>{state.code}</strong><span>{copied ? <><Check /> Copied</> : <><Copy /> Copy</>}</span></button>
    <div className="battle-versus-row"><div><span>{state.players[0]?.charAt(0).toUpperCase() || "?"}</span><b>{state.players[0] || effectivePlayerName}</b><small>Ready</small></div><i>VS</i><div className="is-empty"><span>?</span><b>{state.players[1] || "Opponent"}</b><small>{state.players[1] ? "Joining…" : "Waiting…"}</small></div></div>
    <form className="battle-invite" onSubmit={(event) => { event.preventDefault(); if (inviteEmail.trim()) battle.invite(inviteEmail.trim()); }}><label htmlFor="battle-email">Invite by email</label><div><Mail /><input id="battle-email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="friend@example.com" /><button disabled={!canSend || !inviteEmail.trim()}>{pending === "invite" ? "Sending…" : "Send"}</button></div>{inviteStatus && <p className={inviteStatus.ok ? "is-success" : "is-error"}>{inviteStatus.message}</p>}</form>
    <ErrorNotice message={state.error} onRetry={connection === "offline" ? battle.reconnect : undefined} /><button type="button" className="battle-text-button" disabled={pending === "leave"} onClick={battle.leave}>{pending === "leave" ? "Cancelling…" : "Cancel room"}</button>
  </section></main>;

  if (state.phase === "playing") {
    if (!state.question) return <main className="battle-centered"><LoaderCircle className="battle-spinner" /><p>Loading the first question…</p></main>;
    const q = state.question;
    const opponentSelection = state.reveal && opponentEntry ? state.reveal.selections[opponentEntry[0]] : null;
    const deadlineExpired = expiredQuestionIndex === q.questionIndex;
    return <main className="battle-game-shell"><header className="battle-score-header"><div className="battle-score-meta"><span>Question {q.questionIndex + 1} of {q.total}</span><ConnectionStatus status={connection} /></div><div className="battle-score-grid"><PlayerBlock player={me} fallback={effectivePlayerName} side="me" /><RoundTimer deadline={q.deadline} onExpire={() => setExpiredQuestionIndex(q.questionIndex)} /><PlayerBlock player={opponent} fallback="Opponent" side="opponent" /></div><div className="battle-round-progress"><i style={{ width: `${((q.questionIndex + 1) / q.total) * 100}%` }} /></div></header>
      <div className="battle-game-scroll"><div className="battle-question-wrap">{state.opponentDeadline && <div className="battle-notice"><span>Opponent disconnected. Their reconnect window is still open.</span></div>}
        <motion.section key={q.questionIndex} className="battle-question-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><p className="battle-kicker">Choose one answer</p><RichContent text={q.question} className="battle-question-text" /></motion.section>
        <div className="battle-options">{q.options.map((option, index) => {
          const selected = state.selectedIndex === index, correct = state.reveal?.correctIndex === index;
          const wrong = Boolean(state.reveal && selected && !correct), opponentPicked = opponentSelection === index;
          return <motion.button type="button" key={`${q.questionIndex}-${index}`} whileTap={state.answerStatus === "idle" ? { scale: .985 } : undefined} className={`${selected ? "is-selected" : ""} ${correct ? "is-correct" : ""} ${wrong ? "is-wrong" : ""}`} disabled={state.answerStatus !== "idle" || Boolean(state.reveal) || connection !== "online" || deadlineExpired} onClick={() => battle.submitAnswer(index)}><span>{String.fromCharCode(65 + index)}</span><RichContent text={option} className="battle-option-text" />{opponentPicked && <small>Opponent</small>}{correct && <Check aria-label="Correct answer" />}</motion.button>;
        })}</div>
        <div className="battle-answer-status" aria-live="polite">{state.reveal ? <strong>{state.correct ? "Correct — point secured." : "Round complete. Next question incoming."}</strong> : state.answerStatus !== "idle" ? <><LoaderCircle className="battle-spinner" /><span>Your answer is locked. Waiting for your opponent…</span></> : deadlineExpired ? <span>Time is up. Waiting for the round result…</span> : connection !== "online" ? <><WifiOff /><span>Reconnecting before you can answer…</span></> : <span>Select an option before the timer ends.</span>}</div>
        <ErrorNotice message={state.error} onRetry={connection === "offline" ? battle.reconnect : undefined} />
      </div></div>
    </main>;
  }

  const result = state.result;
  if (!result) return null;
  const outcome = battleOutcome(result, user.id);
  const resultPlayers = Object.entries(result.scores).sort(([, left], [, right]) => right.score - left.score);
  const rating = result.rating;
  const title = outcome === "win" ? "Victory" : outcome === "loss" ? "Good battle" : outcome === "draw" ? "Draw match" : "Battle ended";
  return <main className={`battle-page battle-result-page is-${outcome}`}>{outcome === "win" && <Confetti />}<BattleHeader title="Match result" status={connection} onBack={battle.reset} /><section className="battle-result-shell">
    <div className="battle-result-hero"><span>{outcome === "win" ? <Trophy /> : outcome === "draw" ? <Swords /> : <Shield />}</span><p className="battle-kicker">{result.finishReason === "forfeit" ? "Finished by forfeit" : "Final result"}</p><h1>{title}</h1><p>{outcome === "win" ? "Sharp answers and steady timing." : outcome === "loss" ? "Review the result, then run it back." : outcome === "draw" ? "Nothing separated you this time." : "The match could not be completed."}</p></div>
    <div className="battle-final-scores">{resultPlayers.map(([id, player], index) => <div key={id} className={id === user.id ? "is-me" : ""}><span>{index + 1}</span><i>{player.name.charAt(0).toUpperCase()}</i><p><b>{player.name}</b><small>{id === user.id ? "You" : "Opponent"}</small></p><strong>{player.score}<small> pts</small></strong></div>)}</div>
    {rating && <section className="battle-result-panel"><div><p className="battle-kicker">Rating update</p><h2>{rating.season?.tierAfter || "Lifetime rating"}</h2></div><strong>{rating.season?.after ?? rating.lifetime.after}<small className={(rating.season?.delta ?? rating.lifetime.delta) >= 0 ? "is-positive" : "is-negative"}>{(rating.season?.delta ?? rating.lifetime.delta) >= 0 ? "+" : ""}{rating.season?.delta ?? rating.lifetime.delta}</small></strong></section>}
    {result.matchStats && <section className="battle-stats-panel"><h2>Match breakdown</h2><div><article><span>You</span><strong>{result.matchStats.me.accuracy}%</strong><small>{result.matchStats.me.correct}/{result.matchStats.me.total} correct · {result.matchStats.me.timedOut} timed out</small></article><article><span>Opponent</span><strong>{result.matchStats.opponent.accuracy}%</strong><small>{result.matchStats.opponent.correct}/{result.matchStats.opponent.total} correct · {result.matchStats.opponent.timedOut} timed out</small></article></div></section>}
    <ErrorNotice message={state.error} onRetry={connection === "offline" ? battle.reconnect : undefined} /><div className="battle-result-actions">{result.rematchToken && <button type="button" className="battle-primary-button" disabled={!canSend} onClick={() => battle.rematch(effectivePlayerName)}>{pending === "rematch" ? <LoaderCircle className="battle-spinner" /> : <RotateCcw />}{pending === "rematch" ? "Sending rematch…" : `Rematch ${result.opponentName || "opponent"}`}</button>}<button type="button" className="battle-secondary-button" onClick={battle.reset}><Swords /> New battle</button><Link href="/" className="battle-text-link">Return home</Link></div>
  </section></main>;
}

export default function BattlePage() {
  return <Suspense fallback={<main className="battle-centered"><LoaderCircle className="battle-spinner" /><p>Preparing the arena…</p></main>}><BattlePageContent /></Suspense>;
}

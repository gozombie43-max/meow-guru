"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Swords, Copy, Check, Zap, Target } from "lucide-react";
import RichContent from "@/components/RichContent";
import { getSocket } from "@/lib/socket";

// ── Types ────────────────────────────────────────────────────────────────────
type BattleState = "lobby" | "waiting" | "playing" | "finished";

interface Player {
  name: string;
  score: number;
  answered: boolean;
  lastCorrect?: boolean;
}

interface Scores {
  [socketId: string]: Player;
}

interface BattleQuestion {
  question: string;
  options: string[];
  questionIndex: number;
  total: number;
}

interface SubjectOption {
  value: string;
  label: string;
}

interface TopicOption {
  value: string;
  label: string;
  shortLabel?: string;
  icon?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS: SubjectOption[] = [
  { value: "mathematics", label: "Mathematics" },
  { value: "reasoning", label: "Reasoning" },
  { value: "english", label: "English" },
  { value: "general-awareness", label: "General Awareness" },
];

const MATH_TOPICS: TopicOption[] = [
  { value: "trigonometry", label: "Trigonometry", shortLabel: "Trig", icon: "∫" },
  { value: "algebra",      label: "Algebra",       shortLabel: "Algo", icon: "x²" },
  { value: "geometry",     label: "Geometry",       shortLabel: "Geo", icon: "△" },
  { value: "mensuration",  label: "Mensuration",    shortLabel: "Mens", icon: "⬡" },
  { value: "percentages",  label: "Percentages",    shortLabel: "Perc", icon: "%" },
];

const TOPICS_BY_SUBJECT: Record<string, TopicOption[]> = {
  mathematics: [{ value: "all", label: "All Topics", shortLabel: "All", icon: "ALL" }, ...MATH_TOPICS],
  reasoning: [{ value: "all", label: "All Topics", shortLabel: "All", icon: "ALL" }],
  english: [{ value: "all", label: "All Topics", shortLabel: "All", icon: "ALL" }],
  "general-awareness": [{ value: "all", label: "All Topics", shortLabel: "All", icon: "ALL" }],
};

const QUESTION_COUNTS = [10, 20, 50, 100];

// ── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({
  scores, mySocketId, myName, questionIndex, total,
}: {
  scores: Scores; mySocketId: string; myName: string;
  questionIndex: number; total: number;
}) {
  const players = Object.entries(scores);
  const me = players.find(([id]) => id === mySocketId);
  const opp = players.find(([id]) => id !== mySocketId);

  const meScore = me?.[1]?.score ?? 0;
  const oppScore = opp?.[1]?.score ?? 0;
  const oppName = opp?.[1]?.name ?? "Opponent";
  const meAnswered = me?.[1]?.answered ?? false;
  const oppAnswered = opp?.[1]?.answered ?? false;
  const totalScore = meScore + oppScore || 1;
  const myWidth = Math.round((meScore / totalScore) * 100);

  return (
    <div className="relative overflow-hidden px-4 pt-4 pb-3 sm:px-6"
      style={{
        background: "linear-gradient(120deg,#2a0a4a 0%,#3b0f63 45%,#0f2a4a 55%,#0b3a57 100%)",
      }}>
      <div className="absolute inset-0" style={{
        background: "linear-gradient(120deg, rgba(0,0,0,0) 44%, rgba(255,255,255,0.12) 49%, rgba(0,0,0,0) 55%)",
      }} />
      <div className="absolute inset-0" style={{
        background: "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.12), transparent 35%)",
      }} />

      {/* Header row */}
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-fuchsia-200/90 border-2 border-fuchsia-300 flex items-center justify-center text-xs font-bold text-purple-800">
            {myName[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{myName}</span>
              {meAnswered && (
                <span className="text-[10px] font-semibold text-emerald-200 bg-emerald-500/20 border border-emerald-300/40 rounded-full px-2 py-0.5">
                  answered
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-bold text-white/70 tracking-[0.3em]">QUIZ BATTLE</span>
          <span className="text-xs font-semibold text-white/80 tabular-nums">
            Q {questionIndex + 1}/{total}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-sm font-bold text-white">{oppName}</span>
              {oppAnswered ? (
                <span className="text-[10px] font-semibold text-emerald-200 bg-emerald-500/20 border border-emerald-300/40 rounded-full px-2 py-0.5">
                  answered
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-amber-200 bg-amber-500/20 border border-amber-300/40 rounded-full px-2 py-0.5">
                  thinking...
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-cyan-300/90 border-2 border-cyan-200 flex items-center justify-center text-xs font-bold text-cyan-900">
            {oppName[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Score row */}
      <div className="relative flex items-end justify-between mt-2">
        <div className="flex flex-col">
          <motion.span
            key={`me-score-${meScore}`}
            className="text-3xl font-black text-white tabular-nums"
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            {String(meScore).padStart(2, "0")}
          </motion.span>
          <span className="text-[11px] font-bold text-white/60 tracking-widest">YOUR SCORE</span>
        </div>
        <span className="text-[11px] font-bold text-white/40 tracking-[0.35em]">POINTS</span>
        <div className="flex flex-col items-end">
          <motion.span
            key={`opp-score-${oppScore}`}
            className="text-3xl font-black text-white tabular-nums"
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            {String(oppScore).padStart(2, "0")}
          </motion.span>
          <span className="text-[11px] font-bold text-white/60 tracking-widest">THEIR SCORE</span>
        </div>
      </div>

      {/* Score progress bar */}
      <div className="relative mt-3 h-2.5 w-full rounded-full bg-white/10 overflow-hidden flex">
        <motion.div
          key="my-bar"
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#e879f9,#c026d3)" }}
          animate={{ width: `${myWidth}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        <motion.div
          key="opp-bar"
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#06b6d4,#0ea5e9)" }}
          animate={{ width: `${100 - myWidth}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

// ── Opponent Status ──────────────────────────────────────────────────────────
function OpponentStatus({
  scores, mySocketId, revealedAnswer,
}: {
  scores: Scores; mySocketId: string; revealedAnswer: string | null;
}) {
  const opp = Object.entries(scores).find(([id]) => id !== mySocketId);
  if (!opp) return null;
  const oppData = opp[1];

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-orange-50/80 border-b border-orange-100">
      <div className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center text-[10px] font-bold text-orange-700">
        {oppData.name[0]?.toUpperCase()}
      </div>
      <span className="text-xs font-semibold text-orange-700">{oppData.name}</span>
      {oppData.answered ? (
        revealedAnswer ? (
          <span className="text-xs text-slate-600">
            answered: <span className="font-semibold text-slate-800">{revealedAnswer}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
            <Check className="w-3 h-3" /> Answered
          </span>
        )
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-amber-600">
          <span className="flex gap-0.5">
            {[0,1,2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
          thinking...
        </span>
      )}
    </div>
  );
}

// ── Result Flash ─────────────────────────────────────────────────────────────
function ResultFlash({ isCorrect }: { isCorrect: boolean | null }) {
  if (isCorrect === null) return null;
  return (
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 pointer-events-none z-40 flex items-center justify-center`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          className={`rounded-3xl px-8 py-5 text-white text-2xl font-black shadow-2xl ${
            isCorrect
              ? "bg-emerald-500"
              : "bg-red-500"
          }`}
          initial={{ scale: 0.5, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {isCorrect ? "✓ Correct! +10" : "✗ Wrong!"}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    color: ["#7c3aed","#2563eb","#10b981","#f59e0b","#ef4444","#ec4899"][Math.floor(Math.random()*6)],
    size: 6 + Math.random() * 8,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {pieces.map(p => (
        <motion.div key={p.id}
          className="absolute rounded-sm"
          style={{ left: `${p.x}%`, top: -20, width: p.size, height: p.size, background: p.color }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.5 + Math.random(), delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN BATTLE PAGE
   ════════════════════════════════════════════════════════════════════════════ */
export default function BattlePage() {
  const [battleState, setBattleState]   = useState<BattleState>("lobby");
  const [playerName, setPlayerName]     = useState("");
  const [roomCode, setRoomCode]         = useState("");
  const [joinCode, setJoinCode]         = useState("");
  const [subject, setSubject]           = useState("mathematics");
  const [topic, setTopic]               = useState("all");
  const [questionCount, setQuestionCount] = useState(10);
  const [players, setPlayers]           = useState<string[]>([]);
  const [currentQ, setCurrentQ]         = useState<BattleQuestion | null>(null);
  const [scores, setScores]             = useState<Scores>({});
  const [selected, setSelected]         = useState<string | null>(null);
  const [isCorrect, setIsCorrect]       = useState<boolean | null>(null);
  const [isSubmitted, setIsSubmitted]   = useState(false);
  const [finalScores, setFinalScores]   = useState<Scores>({});
  const [copied, setCopied]             = useState(false);
  const [error, setError]               = useState("");
  const [showResult, setShowResult]     = useState(false);
  const [opponentAnswer, setOpponentAnswer] = useState<string | null>(null);
  const [mySocketId, setMySocketId]     = useState("");
  const [isWinner, setIsWinner]         = useState(false);
  const activeCode = roomCode || joinCode.toUpperCase();

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    setMySocketId(socket.id ?? "");

    socket.on("connect", () => setMySocketId(socket.id ?? ""));

    socket.on("room:created", ({ code }: { code: string }) => {
      setRoomCode(code);
      setBattleState("waiting");
    });

    socket.on("room:joined", ({ players }: { players: string[] }) => {
      setPlayers(players);
    });

    socket.on("room:error", ({ message }: { message: string }) => {
      setError(message);
    });

    socket.on("game:start", ({ total, topic: t }: { total: number; topic: string }) => {
      setBattleState("playing");
      setScores({});
    });

    socket.on("game:question", (q: BattleQuestion) => {
      setCurrentQ(q);
      setSelected(null);
      setIsCorrect(null);
      setShowResult(false);
      setOpponentAnswer(null);
      setIsSubmitted(false);
    });

    socket.on("game:answerResult", ({ isCorrect: correct, opponentAnswer: oppAns }: any) => {
      setIsCorrect(correct);
      setIsSubmitted(true);
      setShowResult(true);
      if (oppAns) setOpponentAnswer(oppAns);
      setTimeout(() => setShowResult(false), 1500);
    });

    socket.on("game:scores", ({ scores: s }: { scores: Scores }) => {
      setScores(s);
    });

    socket.on("game:opponentAnswer", ({ answer }: { answer: string }) => {
      setOpponentAnswer(answer);
    });

    socket.on("game:end", ({ scores: s }: { scores: Scores }) => {
      setFinalScores(s);
      const myScore = s[mySocketId]?.score ?? 0;
      const maxScore = Math.max(...Object.values(s).map(p => p.score));
      setIsWinner(myScore === maxScore);
      setBattleState("finished");
    });

    socket.on("room:playerLeft", ({ message }: { message: string }) => {
      setError(message);
      setBattleState("lobby");
    });

    return () => {
      socket.off("connect");
      socket.off("room:created");
      socket.off("room:joined");
      socket.off("room:error");
      socket.off("game:start");
      socket.off("game:question");
      socket.off("game:answerResult");
      socket.off("game:scores");
      socket.off("game:opponentAnswer");
      socket.off("game:end");
      socket.off("room:playerLeft");
    };
  }, [mySocketId]);

  const topicOptions = TOPICS_BY_SUBJECT[subject] || TOPICS_BY_SUBJECT.mathematics;
  const subjectLabel = SUBJECTS.find(s => s.value === subject)?.label || "Subject";

  // ── Actions ─────────────────────────────────────────────────────────────────
  const createRoom = () => {
    if (!playerName.trim()) { setError("Enter your name first"); return; }
    if (!subject) { setError("Select a subject"); return; }
    if (!topic) { setError("Select a topic"); return; }
    setError("");
    getSocket().emit("room:create", {
      playerName: playerName.trim(),
      subject,
      topic,
      questionCount,
    });
  };

  const joinRoom = () => {
    if (!playerName.trim()) { setError("Enter your name first"); return; }
    if (!joinCode.trim())   { setError("Enter room code"); return; }
    setError("");
    getSocket().emit("room:join", { code: joinCode.trim().toUpperCase(), playerName: playerName.trim() });
  };

  const submitAnswer = (answer: string) => {
    if (isSubmitted) return;
    setSelected(answer);
    getSocket().emit("game:answer", { code: activeCode, answer });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetToLobby = () => {
    setBattleState("lobby");
    setRoomCode("");
    setJoinCode("");
    setCurrentQ(null);
    setScores({});
    setSelected(null);
    setIsCorrect(null);
    setFinalScores({});
    setError("");
    setPlayers([]);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     SCREENS
     ══════════════════════════════════════════════════════════════════════════ */

  // ── Lobby ───────────────────────────────────────────────────────────────────
  if (battleState === "lobby") return (
    <div className="min-h-screen relative overflow-hidden battle-theme battle-lobby">
      <div className="battle-glow battle-glow-1" />
      <div className="battle-glow battle-glow-2" />

      <div className="relative z-10 mx-auto max-w-md px-5 pt-10 pb-10">
        <motion.div className="battle-topbar"
          initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}>
          <span className="battle-back">&lt;</span>
          <span className="battle-title">1v1 Battle Setup</span>
        </motion.div>

        <motion.div className="battle-panel"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}>

          <div className="mb-4">
            <label className="battle-label block mb-2">Player Name</label>
            <input
              className="battle-input"
              placeholder="Enter name..."
              value={playerName}
              onChange={e => { setPlayerName(e.target.value); setError(""); }}
              maxLength={20}
            />
          </div>

          <div className="mb-4">
            <label className="battle-label block mb-2">Subject</label>
            <div className="relative">
              <select
                className="battle-input w-full pr-10"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setTopic("all"); }}
              >
                {SUBJECTS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-200 text-sm">▾</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="battle-label block mb-2">Topic</label>
            <div className="relative">
              <select
                className="battle-input w-full pr-10"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                {topicOptions.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-amber-200 text-sm">▾</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="battle-label block mb-3 text-center">Questions</label>
            <div className="battle-counts">
              {QUESTION_COUNTS.map(count => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`battle-count-btn ${questionCount === count ? "is-active" : ""}`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="battle-helper">
            <span className="battle-info-dot">i</span>
            <span>Game Focus: {questionCount} {subjectLabel} Focus</span>
          </div>
          <div className="battle-focus">* {questionCount} Questions</div>
          <div className="battle-feature">
            <span className="battle-chip">Feature: Reaction Core</span>
          </div>

          <div className="mt-5 space-y-3">
            <button onClick={createRoom} className="battle-btn battle-btn-primary battle-cta w-full">
              <span>Create Battle Room</span>
              <small>Create Battle in 1v1 mode</small>
            </button>

            <button onClick={joinRoom} className="battle-btn battle-btn-primary battle-join-btn w-full">
              Join
            </button>

            <div className="mt-2">
              <label className="battle-label block mb-2">Enter Code:</label>
              <input
                className="battle-input font-mono font-bold tracking-widest uppercase text-center"
                placeholder="Code..."
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase().slice(0, 6)); setError(""); }}
                maxLength={6}
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div className="battle-error mt-3"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="battle-footer">
          <div>+10 Questions</div>
          <div>10 Questions, +10 XP</div>
        </div>
      </div>
    </div>
  );

  // ── Waiting ──────────────────────────────────────────────────────────────────
  if (battleState === "waiting") return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden battle-theme battle-lobby">
      <div className="battle-glow battle-glow-1" />
      <div className="battle-glow battle-glow-2" />

      <motion.div className="relative z-10 battle-panel w-full max-w-sm text-center"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>

        <motion.div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: "rgba(18, 16, 14, 0.9)", border: "1.5px solid rgba(200, 161, 91, 0.45)" }}
          animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
          <Swords className="w-7 h-7 text-amber-300" />
        </motion.div>

        <h2 className="text-lg font-semibold text-amber-100 mb-1">Waiting for opponent...</h2>
        <p className="text-sm text-amber-200/70 mb-6">Share this code with your friend</p>

        <div className="relative mb-6">
          <div className="battle-code">
            <div className="battle-code-text select-all">
              {roomCode}
            </div>
          </div>
          <button onClick={copyCode}
            className="absolute -top-2 -right-2 battle-copy">
            {copied
              ? <Check className="w-4 h-4" />
              : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          {[playerName, players[1]].map((p, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`battle-avatar ${p ? "" : "is-empty"}`}>
                {p ? p[0].toUpperCase() : "?"}
              </div>
              <span className="text-[11px] font-semibold text-amber-200/70">{p || "waiting..."}</span>
            </div>
          ))}
          <span className="battle-vs">VS</span>
        </div>

        <div className="flex gap-1.5 justify-center">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-amber-300"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} />
          ))}
        </div>
      </motion.div>
    </div>
  );

  // ── Playing ──────────────────────────────────────────────────────────────────
  if (battleState === "playing" && currentQ) return (
    <div className="min-h-screen flex flex-col" style={{
      background: "linear-gradient(165deg,#f5f0ff 0%,#eef2ff 38%,#f8faff 100%)",
      fontFamily: "Poppins, Inter, 'Segoe UI', sans-serif",
    }}>

      {/* Result flash overlay */}
      <AnimatePresence>
        {showResult && <ResultFlash isCorrect={isCorrect} />}
      </AnimatePresence>

      {/* ── Header: Score bar ─────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <ScoreBar
          scores={scores} mySocketId={mySocketId}
          myName={playerName}
          questionIndex={currentQ.questionIndex}
          total={currentQ.total}
        />
      </div>

      {/* ── Opponent status strip ──────────────────────────── */}
      <OpponentStatus scores={scores} mySocketId={mySocketId} revealedAnswer={opponentAnswer} />

      {/* ── Main content ──────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-2xl px-3 pt-4 pb-36 overflow-y-auto">

        {/* Question count */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5">
            <span className="text-xs font-bold text-slate-500">
              Q {currentQ.questionIndex + 1} of {currentQ.total}
            </span>
          </div>
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div key={currentQ.questionIndex}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}
            className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(124,58,237,0.08)] px-5 py-5 sm:px-7 sm:py-6 mb-5"
            style={{ minHeight: 140 }}>
            <div className="text-[17px] font-normal text-slate-900 leading-relaxed"
              style={{ paddingLeft: "0.2cm", paddingRight: "0.2cm" }}>
              <RichContent text={currentQ.question} className="leading-relaxed" />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Options */}
        <div className="space-y-3">
          {currentQ.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const isSelected = selected === opt;
            const hasSubmitted = selected !== null;

            let borderColor = "#E5E7EB";
            let bg = "#FFFFFF";
            let letterBg = "transparent";
            let letterBorder = "#7C3AED";
            let letterText = "#5B21B6";

            if (hasSubmitted && isSelected && isCorrect === true) {
              borderColor = "#16A34A"; bg = "#F0FDF4";
              letterBg = "#16A34A"; letterBorder = "#16A34A"; letterText = "#fff";
            } else if (hasSubmitted && isSelected && isCorrect === false) {
              borderColor = "#DC2626"; bg = "#FEF2F2";
              letterBg = "#DC2626"; letterBorder = "#DC2626"; letterText = "#fff";
            } else if (!hasSubmitted && isSelected) {
              borderColor = "#7C3AED"; bg = "#F5F3FF";
              letterBg = "#7C3AED"; letterBorder = "#7C3AED"; letterText = "#fff";
            }

            return (
              <motion.button key={i}
                onClick={() => submitAnswer(opt)}
                disabled={isSubmitted}
                whileTap={!isSubmitted ? { scale: 0.97 } : undefined}
                style={{
                  width: "100%", minHeight: 58, background: bg,
                  border: `1.5px solid ${borderColor}`, borderRadius: 16,
                  padding: "0 16px", display: "flex", alignItems: "center",
                  gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  cursor: isSubmitted ? "default" : "pointer",
                  transition: "all 0.15s ease", fontSize: 17, fontWeight: 400,
                  color: "#111827", outline: "none",
                }}>
                {/* Letter bubble */}
                <span style={{
                  width: 34, height: 34, border: `1.5px solid ${letterBorder}`,
                  borderRadius: "50%", background: letterBg, color: letterText,
                  fontSize: 13, fontWeight: 600, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.15s ease",
                }}>
                  {letter}
                </span>

                {/* Option text with KaTeX */}
                <div style={{ fontSize: 16, fontWeight: 400, color: "#111827", lineHeight: 1.5, flex: 1, textAlign: "left" }}>
                  <RichContent text={opt} />
                </div>

                {/* Opponent answered this? */}
                {opponentAnswer === opt && (
                  <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-1.5 py-0.5 flex-shrink-0">
                    opp
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Waiting message after answering */}
        <AnimatePresence>
          {selected && (
            <motion.div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 flex items-center gap-3"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <motion.div key={`ans-dot-${i}`} className="w-1.5 h-1.5 rounded-full bg-violet-400"
                    animate={{ opacity: [0.3,1,0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i*0.2 }} />
                ))}
              </div>
              <span className="text-sm font-medium text-violet-700">
                Waiting for opponent...
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );

  // ── Finished ─────────────────────────────────────────────────────────────────
  if (battleState === "finished") {
    const sorted = Object.entries(finalScores).sort(([,a],[,b]) => b.score - a.score);
    const me = finalScores[mySocketId];
    const opp = Object.entries(finalScores).find(([id]) => id !== mySocketId);
    const myScore = me?.score ?? 0;
    const oppScore = opp?.[1]?.score ?? 0;
    const isDraw = myScore === oppScore;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
        style={{ background: "linear-gradient(165deg,#f5f0ff 0%,#eef2ff 38%,#f8faff 100%)" }}>
        <div className="bg-blob-1" /><div className="bg-blob-2" />

        {isWinner && !isDraw && <Confetti />}

        <motion.div className="relative z-10 w-full max-w-sm"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}>

          {/* Result banner */}
          <div className="text-center mb-6">
            <motion.div className="text-6xl mb-3"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}>
              {isDraw ? "🤝" : isWinner ? "🏆" : "💪"}
            </motion.div>
            <h2 className="text-3xl font-black text-slate-900 mb-1"
              style={{ fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif" }}>
              {isDraw ? "It's a Draw!" : isWinner ? "You Win!" : "Good Fight!"}
            </h2>
            <p className="text-sm text-slate-500">
              {isDraw ? "Both fought equally well" : isWinner ? "Outstanding performance!" : `${opp?.[1]?.name} wins this round`}
            </p>
          </div>

          {/* Score cards */}
          <div className="glass-panel mb-5">
            <div className="space-y-3">
              {sorted.map(([id, player], rank) => {
                const isMe = id === mySocketId;
                return (
                  <motion.div key={id}
                    className="flex items-center gap-3 rounded-2xl p-3"
                    style={{
                      background: isMe ? "rgba(124,58,237,0.08)" : "rgba(249,115,22,0.06)",
                      border: `1.5px solid ${isMe ? "rgba(124,58,237,0.2)" : "rgba(249,115,22,0.2)"}`,
                    }}
                    initial={{ opacity: 0, x: isMe ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + rank * 0.1 }}>
                    <span className="text-xl">{rank === 0 ? "🥇" : "🥈"}</span>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2"
                      style={{
                        background: isMe ? "rgba(124,58,237,0.12)" : "rgba(249,115,22,0.12)",
                        borderColor: isMe ? "#7c3aed" : "#f97316",
                        color: isMe ? "#6d28d9" : "#ea580c",
                      }}>
                      {player.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-800">{player.name}</span>
                      {isMe && <span className="ml-1.5 text-[10px] text-violet-600 font-semibold">(you)</span>}
                    </div>
                    <motion.div className="text-right"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + rank * 0.1 }}>
                      <div className="text-xl font-black"
                        style={{ color: isMe ? "#6d28d9" : "#ea580c" }}>
                        {player.score}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold">pts</div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            {/* Score diff */}
            {!isDraw && (
              <motion.div className="mt-4 text-center rounded-xl py-2.5"
                style={{ background: isWinner ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.06)" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                <span className="text-sm font-bold"
                  style={{ color: isWinner ? "#059669" : "#dc2626" }}>
                  {isWinner
                    ? `You won by ${myScore - oppScore} points! 🎉`
                    : `Lost by ${oppScore - myScore} points. Keep grinding! 💪`}
                </span>
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button onClick={resetToLobby}
              className="h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg,#7c3aed 0%,#2563eb 100%)",
                boxShadow: "0 8px 24px rgba(124,58,237,0.3)",
              }}>
              <Swords className="w-4 h-4" /> Play Again
            </button>
            <a href="/mathematics"
              className="h-12 rounded-2xl font-semibold text-slate-700 text-sm flex items-center justify-center gap-2 border border-slate-200 bg-white/70">
              Back to Practice
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
"use client";

import { useEffect, useState } from "react";
import { BattleIntegrityEvent, BattleIntegritySummary, fetchBattleIntegrityEvents, fetchBattleIntegritySummary, reviewBattleIntegrityEvent } from "@/lib/api/battleIntegrityApi";

export default function BattleIntegrityPage() {
  const [summary, setSummary] = useState<BattleIntegritySummary | null>(null);
  const [events, setEvents] = useState<BattleIntegrityEvent[]>([]);
  const [error, setError] = useState("");
  const load = async () => { try { const [nextSummary, nextEvents] = await Promise.all([fetchBattleIntegritySummary(), fetchBattleIntegrityEvents()]); setSummary(nextSummary); setEvents(nextEvents.items); } catch { setError("Could not load integrity signals."); } };
  useEffect(() => { void load(); }, []);
  const review = async (id: string, status: "reviewed" | "dismissed" | "escalated") => { try { await reviewBattleIntegrityEvent(id, status); await load(); } catch { setError("Could not save the review decision."); } };
  return <main className="mx-auto max-w-5xl p-6 text-slate-900"><h1 className="text-2xl font-black">Battle Integrity</h1><p className="mt-1 text-sm text-slate-600">Signals require human review. They do not automatically affect accounts or ratings.</p>
    <section className="mt-6 grid gap-3 sm:grid-cols-3">{[["Open signals", summary?.openSignals], ["High severity", summary?.highSeverity], ["Flagged players", summary?.flaggedPlayers]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-black">{value ?? "—"}</div></div>)}</section>
    {error && <p className="mt-5 text-sm text-rose-600">{error}</p>}
    <section className="mt-6 space-y-3">{events.map((event) => <article key={event._id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><span className={`mr-2 rounded px-2 py-1 text-xs font-black ${event.severity === "high" ? "bg-rose-100 text-rose-700" : event.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{event.severity.toUpperCase()}</span><span className="font-bold">{event.signalType.replaceAll("-", " ")}</span><p className="mt-2 text-sm text-slate-600">Player {event.userId}{event.opponentUserId ? ` ↔ ${event.opponentUserId}` : ""}{event.roomCode ? ` · Room ${event.roomCode}` : ""}</p><pre className="mt-2 overflow-auto text-xs text-slate-500">{JSON.stringify(event.details)}</pre></div><div className="flex gap-2"><button onClick={() => void review(event._id, "reviewed")} className="rounded border px-3 py-1.5 text-sm">Review</button><button onClick={() => void review(event._id, "escalated")} className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white">Escalate</button><button onClick={() => void review(event._id, "dismissed")} className="rounded border px-3 py-1.5 text-sm">Dismiss</button></div></div></article>)}{!events.length && !error && <p className="text-sm text-slate-500">No open integrity signals.</p>}</section>
  </main>;
}

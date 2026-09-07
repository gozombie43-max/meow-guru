"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BattleRankCard } from "@/components/battle/BattleRankCard";
import { fetchBattleProfile } from "@/lib/api/battleProfileApi";
const ICONS: Record<string, string> = { trophy: "🏆", flame: "🔥", zap: "⚡", shield: "🛡️", crown: "👑", sparkles: "✨", gem: "💎" };
export default function BattleProfilePage() {
  const [data, setData] = useState<any>(null), [error, setError] = useState("");
  useEffect(() => { void fetchBattleProfile().then(setData).catch(() => setError("Could not load your battle profile.")); }, []);
  if (error) return <main className="p-6 text-rose-600">{error}</main>;
  if (!data) return <main className="p-6 text-slate-500">Loading battle profile…</main>;
  const season = data.season?.profile;
  return <main className="mx-auto min-h-dvh max-w-2xl bg-slate-50 p-4 text-slate-900"><Link href="/battle" className="text-sm font-semibold text-violet-700">← Back to Battle</Link><h1 className="mt-4 text-3xl font-black">Battle Profile</h1>
    <div className="mt-5">{season ? <BattleRankCard name={data.season.info.name} profile={season} /> : <div className="rounded-3xl bg-slate-800 p-6 text-white">No active competitive season.</div>}</div>
    <section className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-sm"><div><div className="text-xs text-slate-500">Lifetime</div><div className="text-xl font-black">{data.lifetime.rating}</div></div><div><div className="text-xs text-slate-500">Peak rating</div><div className="text-xl font-black">{data.lifetime.peakRating}</div></div><div><div className="text-xs text-slate-500">Record</div><div className="font-bold">{data.lifetime.wins}W · {data.lifetime.losses}L · {data.lifetime.draws}D</div></div><div><div className="text-xs text-slate-500">Best streak</div><div className="font-bold">🔥 {data.lifetime.bestWinStreak}</div></div></section>
    <h2 className="mt-7 text-lg font-black">Achievements</h2><div className="mt-3 flex flex-wrap gap-2">{data.achievements.length ? data.achievements.map((item: any) => <div key={item.achievementCode} title={item.description} className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm">{ICONS[item.icon] || "🏅"} {item.title}</div>) : <p className="text-sm text-slate-500">Win battles to unlock achievements.</p>}</div>
    <h2 className="mt-7 text-lg font-black">Recent Battles</h2><div className="mt-3 space-y-2">{data.recentMatches.map((match: any) => <div key={match.id} className="flex items-center rounded-xl bg-white p-3 shadow-sm"><span className={`mr-3 font-black ${match.result === "win" ? "text-emerald-600" : match.result === "loss" ? "text-rose-600" : "text-slate-500"}`}>{match.result[0]?.toUpperCase()}</span><div className="flex-1"><div className="font-bold">vs {match.opponent.name}</div><div className="text-xs text-slate-500">{match.subject} · {match.myScore}–{match.opponentScore}</div></div><span className={match.ratingDelta >= 0 ? "text-emerald-600" : "text-rose-600"}>{match.ratingDelta >= 0 ? "+" : ""}{match.ratingDelta}</span></div>)}</div>
    <h2 className="mt-7 text-lg font-black">Season Badges</h2><div className="mt-3 flex flex-wrap gap-2">{data.rewards.length ? data.rewards.map((reward: any) => <div key={reward._id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm">🏅 {reward.badge?.label}</div>) : <p className="text-sm text-slate-500">Finish a season to earn badges.</p>}</div>
  </main>;
}

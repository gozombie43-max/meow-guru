"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { rank: number; userId: string; displayName: string; rating: number; tier?: string; gamesPlayed: number; wins: number; losses: number; draws: number; streak: number };
type Season = { name: string; endsAt: string } | null;
type MyProfile = { rating: number; tier: string; gamesPlayed: number; wins: number; losses: number; draws: number; currentWinStreak: number } | null;

export default function BattleLeaderboardPage() {
  const [tab, setTab] = useState<"season" | "lifetime">("season");
  const [items, setItems] = useState<Item[]>([]);
  const [season, setSeason] = useState<Season>(null);
  const [myProfile, setMyProfile] = useState<MyProfile>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const leaderboard = fetch(tab === "season" ? "/backend-api/battle/season/leaderboard" : "/backend-api/battle/leaderboard", { credentials: "include", signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error("Could not load leaderboard."); return response.json(); });
    const mine = tab === "season" ? fetch("/backend-api/battle/season/me", { credentials: "include", signal: controller.signal }).then((response) => response.ok ? response.json() : null) : Promise.resolve(null);
    Promise.all([leaderboard, mine])
      .then(([data, me]) => { setItems(data.items || []); setSeason(data.season || null); setMyProfile(me?.profile || null); })
      .catch((cause) => { if (cause.name !== "AbortError") setError("Could not load leaderboard."); });
    return () => controller.abort();
  }, [tab]);
  const endsIn = season?.endsAt ? Math.max(0, Math.ceil((new Date(season.endsAt).getTime() - Date.now()) / 86_400_000)) : null;
  return <main className="mx-auto min-h-dvh max-w-2xl bg-slate-50 px-4 py-7 text-slate-900">
    <Link href="/battle" className="text-sm font-semibold text-violet-700">← Back to Battle</Link>
    <h1 className="mt-5 text-2xl font-black">Battle Leaderboard</h1>
    <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-200 p-1">
      {(["season", "lifetime"] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-3 py-2 text-sm font-bold ${tab === value ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{value === "season" ? "SEASON" : "LIFETIME"}</button>)}
    </div>
    {tab === "season" && <p className="mt-4 text-sm text-slate-600">{season ? <><strong>{season.name}</strong>{endsIn !== null ? ` · Ends in ${endsIn}d` : ""}</> : "No active season."}</p>}
    {tab === "season" && myProfile && <section className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
      {myProfile.gamesPlayed < 5 ? <><div className="text-xs font-black tracking-[0.14em] text-violet-600">UNRANKED</div><div className="mt-1 font-bold">Placement Matches</div><div className="mt-2 h-2 overflow-hidden rounded bg-violet-200"><div className="h-full bg-violet-600" style={{ width: `${myProfile.gamesPlayed / 5 * 100}%` }} /></div><p className="mt-2 text-sm text-slate-600">{myProfile.gamesPlayed} / 5 completed · Play {5 - myProfile.gamesPlayed} more ranked battles to receive your season rank.</p></> : <><div className="text-xs font-black tracking-[0.14em] text-violet-600">YOUR SEASON RANK</div><div className="mt-1 text-lg font-black">{myProfile.tier} · {myProfile.rating} ELO</div><p className="text-sm text-slate-600">{myProfile.wins}W · {myProfile.losses}L · {myProfile.draws}D {myProfile.currentWinStreak ? `· 🔥 ${myProfile.currentWinStreak}` : ""}</p></>}
    </section>}
    {error ? <p className="mt-6 text-sm text-rose-600">{error}</p> : <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {items.length === 0 ? <p className="p-5 text-sm text-slate-500">No ranked players yet.</p> : items.map((item) => <div key={item.userId} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"><span className="w-7 font-black text-slate-400">#{item.rank}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.displayName}</div><div className="text-xs text-slate-500">{item.wins}W · {item.losses}L · {item.draws}D {item.streak ? `· 🔥 ${item.streak}` : ""}</div></div><div className="text-right"><div className="text-sm font-black">{item.rating}</div><div className="text-[11px] font-semibold text-violet-600">{item.tier || "Lifetime"}</div></div></div>)}
    </div>}
  </main>;
}

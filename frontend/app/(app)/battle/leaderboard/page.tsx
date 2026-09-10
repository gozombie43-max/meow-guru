"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { Avatar, BattleSection, Empty, Panel, Progress, Stats, useBattleResource } from "../_shared/BattleSection";

type Item = { rank: number; userId: string; displayName: string; rating: number; tier?: string; gamesPlayed: number; wins: number; losses: number; draws: number; streak: number };
type Board = { items: Item[]; season?: { name: string; endsAt: string } | null };
type Mine = { profile: { rating: number; tier: string; gamesPlayed: number; wins: number; losses: number; draws: number } | null };

export default function BattleLeaderboardPage() {
  const [tab, setTab] = useState<"season" | "lifetime">("season");
  const { user } = useAuth();
  const { data, error, mutate } = useBattleResource<Board>(`battle-leaderboard-${tab}`, async () => (await api.get(tab === "season" ? "/api/battle/season/leaderboard" : "/api/battle/leaderboard")).data);
  const { data: mine } = useBattleResource<Mine>("battle-season-me", async () => (await api.get("/api/battle/season/me")).data);
  const profile = mine?.profile;
  return <BattleSection title="Leaderboard" description="See who's setting the pace in the arena." loading={!data} error={Boolean(error)} retry={() => void mutate()}>
    <div className="bs-segments" role="group" aria-label="Ranking period">{(["season", "lifetime"] as const).map(value => <button data-ui-button="state" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === "season" ? "This season" : "All time"}</button>)}</div>
    <div className="bs-columns">
      <div className="bs-stack"><section className="bs-hero"><span className="bs-hero-icon"><Trophy size={23} /></span><p className="bs-eyebrow">{tab === "season" ? "SEASON STANDINGS" : "LIFETIME STANDINGS"}</p><h2>{tab === "season" ? data?.season?.name || "Between seasons" : "The long game"}</h2><p>{tab === "season" ? data?.season ? `Season ends ${new Date(data.season.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.` : "Rankings will return when the next season starts." : "A record of consistency, one battle at a time."}</p></section>
        {tab === "season" && profile && <Panel title="Your standing">{profile.gamesPlayed < 5 ? <div className="bs-panel-body"><p>Placement matches</p><Progress value={profile.gamesPlayed / 5 * 100} label="Placement matches completed" /><p className="bs-eyebrow">{profile.gamesPlayed} / 5 COMPLETE</p></div> : <Stats items={[{ label: "Tier", value: profile.tier }, { label: "Rating", value: profile.rating }, { label: "Wins", value: profile.wins }, { label: "Battles", value: profile.gamesPlayed }]} />}</Panel>}
      </div>
      <Panel title="Standings" aside={<span>{data?.items.length || 0} players</span>}>
        {data?.items.length ? data.items.map(item => <div key={item.userId} className={`bs-row ${item.userId === user?.id ? "is-me" : ""}`}>
          <span className="bs-rank">#{item.rank}</span><Avatar name={item.displayName} /><div className="bs-row-main"><strong>{item.displayName}{item.userId === user?.id ? " · You" : ""}</strong><small>{item.wins}W · {item.losses}L · {item.draws}D{item.streak > 0 ? ` · ${item.streak} win streak` : ""}</small></div><div className="bs-row-end">{item.rating}<small>{item.tier || "Rating"}</small></div>
        </div>) : <Empty title="The board is open" detail="Complete ranked battles to start climbing." />}
      </Panel>
    </div>
  </BattleSection>;
}

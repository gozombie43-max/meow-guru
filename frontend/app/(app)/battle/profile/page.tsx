"use client";

import Link from "next/link";
import { Award, Shield, Trophy } from "lucide-react";
import { fetchBattleProfile } from "@/lib/api/battleProfileApi";
import { Avatar, BattleSection, Empty, Panel, Progress, Stats, useBattleResource } from "../_shared/BattleSection";

type Profile = {
  lifetime: { rating: number; peakRating: number; gamesPlayed: number; wins: number; losses: number; draws: number; bestWinStreak: number };
  season: { info: { name: string }; profile: { tier: string; rating: number; gamesPlayed: number } } | null;
  achievements: { achievementCode: string; title: string; description: string }[];
  rewards: { _id: string; badge?: { label: string } }[];
  recentMatches: { id: string; result: string; opponent: { name: string }; subject: string; myScore: number; opponentScore: number; ratingDelta: number }[];
};

export default function BattleProfilePage() {
  const { data, error, mutate } = useBattleResource<Profile>("battle-profile", fetchBattleProfile);
  const life = data?.lifetime;
  const season = data?.season;
  const unranked = season?.profile.tier === "Unranked";
  return <BattleSection title="Your profile" description="Every battle adds to your story." loading={!data} error={Boolean(error)} retry={() => void mutate()}>
    {data && life && <div className="bs-columns">
      <div className="bs-stack">
        <section className="bs-hero"><span className="bs-hero-icon"><Shield size={23} /></span><p className="bs-eyebrow">{season?.info.name || "LIFETIME RECORD"}</p>
          <h2>{season ? season.profile.tier : "Your battle rating"}</h2>
          <p>{unranked ? "Complete your placements to reveal your season rank." : <><strong>{season?.profile.rating ?? life.rating}</strong> rating · Keep challenging yourself.</>}</p>
          {unranked && <><Progress value={season.profile.gamesPlayed / 5 * 100} label="Placement matches" /><p>{Math.min(5, season.profile.gamesPlayed)} of 5 placements completed</p></>}
          <Link data-ui-button="secondary" className="bs-button" href="/battle">Enter the arena</Link>
        </section>
        <Panel title="At a glance"><Stats items={[{ label: "Lifetime rating", value: life.rating }, { label: "Peak rating", value: life.peakRating }, { label: "Battles played", value: life.gamesPlayed }, { label: "Win rate", value: life.gamesPlayed ? `${Math.round(life.wins / life.gamesPlayed * 100)}%` : "—" }, { label: "Wins / Losses / Draws", value: `${life.wins} / ${life.losses} / ${life.draws}` }, { label: "Best win streak", value: life.bestWinStreak }]} /></Panel>
        <Panel title="Season badges" aside={<Link href="/battle/rewards">Reward track →</Link>}>{data.rewards.length ? <div className="bs-awards">{data.rewards.map(reward => <div className="bs-award" key={reward._id}><Award size={22} /><strong>{reward.badge?.label || "Season reward"}</strong></div>)}</div> : <Empty title="Your collection starts here" detail="Finish a season to earn your first badge." />}</Panel>
      </div>
      <div className="bs-stack">
        <Panel title="Recent battles" aside={<span>Last {data.recentMatches.length}</span>}>{data.recentMatches.length ? data.recentMatches.map(match => <div className="bs-row" key={match.id}>
          <Avatar name={match.opponent.name} /><div className="bs-row-main"><strong>{match.opponent.name}</strong><small>{match.subject.replaceAll("-", " ")} · {match.myScore}–{match.opponentScore}</small></div>
          <span className={`bs-result ${match.result === "win" ? "bs-positive" : match.result === "loss" ? "bs-negative" : ""}`}>{match.result}</span>
          <div className={`bs-row-end ${match.ratingDelta >= 0 ? "bs-positive" : "bs-negative"}`}>{match.ratingDelta > 0 ? "+" : ""}{match.ratingDelta}<small>rating</small></div>
        </div>) : <Empty title="A fresh start" detail="Play your first battle and your match history will appear here." />}</Panel>
        <Panel title="Achievements" aside={<Trophy size={18} />}>{data.achievements.length ? <div className="bs-awards">{data.achievements.map(item => <div className="bs-award" key={item.achievementCode}><Award size={24} /><strong>{item.title}</strong><small>{item.description}</small></div>)}</div> : <Empty title="Something to aim for" detail="Win battles, build a streak, and unlock achievements along the way." />}</Panel>
      </div>
    </div>}
  </BattleSection>;
}

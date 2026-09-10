"use client";

import { useRef, useState } from "react";
import { Check, Zap } from "lucide-react";
import { claimBattleMission, fetchBattleMissions } from "@/lib/api/battleMissionApi";
import { BattleSection, Empty, Panel, Progress, Stats, useBattleResource } from "../_shared/BattleSection";

type Mission = { id: string | null; code: string; title: string; description: string; xpReward: number; progress: number; target: number; completed: boolean; claimed: boolean };
type Missions = { lifetime: { level: number; xpIntoLevel: number; xpForNextLevel: number }; season: { name: string; level: number; xp: number } | null; daily: Mission[]; weekly: Mission[] };

export default function BattleMissionsPage() {
  const { data, error, mutate } = useBattleResource<Missions>("battle-missions", fetchBattleMissions);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const claim = async (id: string) => {
    if (busy.current) return;
    busy.current = true; setPending(id); setNotice(null);
    try { const result = await claimBattleMission(id); setNotice({ text: `+${result.xpAwarded} XP added to your battle progress.` }); await mutate(); }
    catch { setNotice({ text: "Could not confirm the claim. Refresh your missions before trying again.", error: true }); }
    finally { busy.current = false; setPending(null); }
  };
  const group = (title: string, items: Mission[]) => <Panel title={title} aside={<span>{items.filter(m => m.claimed).length}/{items.length} claimed</span>}>
    {items.length ? items.map(mission => <article key={mission.code} className="bs-mission"><div className="bs-mission-top"><h3>{mission.title}</h3><strong>+{mission.xpReward} XP</strong></div><p>{mission.description}</p>
      <Progress value={mission.target > 0 ? mission.progress / mission.target * 100 : 0} label={mission.title} />
      <div className="bs-mission-bottom"><span>{mission.progress} / {mission.target}</span>{mission.claimed ? <span className="bs-positive"><Check size={13} style={{ display: "inline" }} /> Claimed</span> : mission.completed && mission.id ? <button data-ui-button="secondary" className="bs-button" disabled={Boolean(pending)} onClick={() => void claim(mission.id!)}>{pending === mission.id ? "Claiming…" : "Claim XP"}</button> : <span>In progress</span>}</div>
    </article>) : <Empty title="No missions available" detail="Check back for your next challenges." />}
  </Panel>;
  const all = [...(data?.daily || []), ...(data?.weekly || [])];
  return <BattleSection title="Missions" description="Small challenges. Steady progress." loading={!data} error={Boolean(error)} retry={() => void mutate()}>
    {notice && <div className={`bs-notice ${notice.error ? "is-error" : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}{notice.error && <button data-ui-button="secondary" className="bs-button secondary" onClick={() => void mutate()}>Refresh</button>}</div>}
    {data && <div className="bs-columns"><div className="bs-stack">
      <section className="bs-hero"><span className="bs-hero-icon"><Zap size={23} /></span><p className="bs-eyebrow">BATTLE LEVEL</p><h2>Level {data.lifetime.level}</h2><p>{data.lifetime.xpForNextLevel ? `${data.lifetime.xpIntoLevel} / ${data.lifetime.xpForNextLevel} XP to the next level` : "Maximum level reached"}</p><Progress value={data.lifetime.xpForNextLevel ? data.lifetime.xpIntoLevel / data.lifetime.xpForNextLevel * 100 : 100} label="Battle level progress" />{data.season && <p>{data.season.name} · Level {data.season.level} · {data.season.xp} XP</p>}</section>
      <Panel title="Your progress"><Stats items={[{ label: "Completed", value: all.filter(m => m.completed).length }, { label: "Ready to claim", value: all.filter(m => m.completed && !m.claimed).length }]} /></Panel>
    </div><div className="bs-stack">{group("Daily missions", data.daily)}{group("Weekly missions", data.weekly)}</div></div>}
  </BattleSection>;
}

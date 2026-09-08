"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Star, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchBattleRivalry, fetchBattleSocial, respondBattleFriendRequest, setBattleFavorite } from "@/lib/api/battleSocialApi";
import { getSocket } from "@/lib/socket";
import { Avatar, BattleSection, Empty, Panel, Stats, useBattleResource } from "../_shared/BattleSection";

type Player = { userId: string; displayName: string; online: boolean; favorite: boolean; season: { rating: number; tier: string } | null; lastPlayedAt?: string };
type Social = { friends: Player[]; requests: Player[]; favorites: Player[]; recentOpponents: Player[] };
type Rivalry = { total: number; wins: number; losses: number; draws: number };
export default function BattleSocialPage() {
  const { data, error, mutate } = useBattleResource<Social>("battle-social", fetchBattleSocial);
  const { token, user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"friends" | "favorites" | "recentOpponents">("friends");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const challengeTarget = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notice, setNotice] = useState("");
  const [rivalry, setRivalry] = useState<(Rivalry & { name: string }) | null>(null);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket(token);
    const finish = () => { if (timer.current) clearTimeout(timer.current); challengeTarget.current = null; busy.current = false; setPending(null); };
    const sent = ({ roomCode, targetUserId }: { roomCode: string; targetUserId: string }) => {
      if (targetUserId !== challengeTarget.current) return;
      finish();
      try { localStorage.setItem(`meow_active_battle_code:${user.id}`, roomCode); } catch { /* Server recovery also restores the room. */ }
      router.push("/battle");
    };
    const failed = ({ message }: { message: string }) => { if (!challengeTarget.current) return; finish(); setNotice(message || "Could not send this challenge."); };
    socket.on("battle:challengeSent", sent).on("room:error", failed);
    return () => { socket.off("battle:challengeSent", sent).off("room:error", failed); if (timer.current) clearTimeout(timer.current); busy.current = false; challengeTarget.current = null; };
  }, [token, user, router]);

  const action = async (id: string, job: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true; setPending(id); setNotice("");
    try { await job(); await mutate(); } catch { setNotice("Could not complete that action. Please try again."); }
    finally { busy.current = false; setPending(null); }
  };
  const challenge = (player: Player) => {
    if (!token || busy.current) return;
    const socket = getSocket(token);
    if (!socket.connected) { setNotice("Connecting to the arena. Please try again in a moment."); return; }
    busy.current = true; challengeTarget.current = player.userId; setPending(player.userId); setNotice("");
    socket.emit("battle:challengeUser", { targetUserId: player.userId, subject: "mathematics", topic: "all", questionCount: 10 });
    timer.current = setTimeout(() => {
      challengeTarget.current = null; busy.current = false; setPending(null);
      setNotice("The challenge has not been confirmed. Open the arena to check for your room before sending another.");
    }, 12000);
  };
  const players = (data?.[tab] || []).filter(player => player.displayName.toLowerCase().includes(search.trim().toLowerCase()));
  return <BattleSection title="Social" description="Find your rivals. Bring your best." loading={!data} error={Boolean(error)} retry={() => void mutate()}>
    {notice && <div className="bs-notice" role="status">{notice}</div>}
    {data && <div className="bs-columns"><div className="bs-stack">
      <section className="bs-hero"><span className="bs-hero-icon"><Users size={23} /></span><p className="bs-eyebrow">YOUR BATTLE CIRCLE</p><h2>{data.friends.filter(p => p.online).length} online</h2><p>Challenge a friend to a 10-question mathematics battle, or catch up with a recent opponent.</p></section>
      <Panel title="Your connections"><Stats items={[{ label: "Friends", value: data.friends.length }, { label: "Favorites", value: data.favorites.length }]} /></Panel>
      {rivalry && <Panel title={`You vs ${rivalry.name}`}><Stats items={[{ label: "Battles", value: rivalry.total }, { label: "Wins", value: rivalry.wins }, { label: "Losses", value: rivalry.losses }, { label: "Draws", value: rivalry.draws }]} /></Panel>}
    </div><div className="bs-stack">
      {data.requests.length > 0 && <Panel title="Friend requests" aside={<span>{data.requests.length} pending</span>}>{data.requests.map(player => <div className="bs-row bs-social-row" key={player.userId}><Avatar name={player.displayName} /><div className="bs-row-main"><strong>{player.displayName}</strong><small>Wants to join your battle circle</small></div><div className="bs-social-actions"><button className="bs-button" disabled={Boolean(pending)} onClick={() => void action(player.userId, () => respondBattleFriendRequest(player.userId, "accept"))}>Accept</button><button className="bs-button secondary" disabled={Boolean(pending)} onClick={() => void action(player.userId, () => respondBattleFriendRequest(player.userId, "decline"))}>Decline</button></div></div>)}</Panel>}
      <div>
        <label className="bs-search"><Search size={18} /><input aria-label="Find a player" placeholder="Find a player…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="bs-segments" role="group" aria-label="Player groups">{(["friends", "favorites", "recentOpponents"] as const).map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === "recentOpponents" ? "Recent" : value === "friends" ? "Friends" : "Favorites"}</button>)}</div>
        <Panel title={tab === "recentOpponents" ? "Recent opponents" : tab === "friends" ? "Friends" : "Favorites"} aside={<span>{players.length}</span>}>
          {players.length ? players.map(player => <div className="bs-row bs-social-row" key={player.userId}>
            <Avatar name={player.displayName} /><div className="bs-row-main"><strong>{player.displayName}</strong><small><span className={`bs-status ${player.online ? "online" : ""}`}>{player.online ? "Online" : "Offline"}</span>{player.season ? ` · ${player.season.tier} · ${player.season.rating}` : " · Unranked"}{player.lastPlayedAt ? ` · Played ${new Date(player.lastPlayedAt).toLocaleDateString()}` : ""}</small></div>
            <button className="bs-favorite" aria-label={`${player.favorite ? "Remove" : "Add"} ${player.displayName} ${player.favorite ? "from" : "to"} favorites`} aria-pressed={player.favorite} disabled={Boolean(pending)} onClick={() => void action(player.userId, () => setBattleFavorite(player.userId, !player.favorite))}><Star size={19} fill={player.favorite ? "currentColor" : "none"} /></button>
            <div className="bs-social-actions"><button className="bs-button" disabled={Boolean(pending)} onClick={() => challenge(player)}>{pending === player.userId ? "Please wait…" : "Challenge"}</button><button className="bs-button secondary" disabled={Boolean(pending)} onClick={() => void action(player.userId, async () => { const result: Rivalry = await fetchBattleRivalry(player.userId); setRivalry({ ...result, name: player.displayName }); })}>View rivalry</button></div>
          </div>) : <Empty title={search ? "No players found" : "Your next rival is out there"} detail={search ? "Try a different name." : "Play battles to meet opponents. Friends and favorites will appear here."} />}
        </Panel>
      </div>
    </div></div>}
  </BattleSection>;
}

"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { battleReducer, initialBattleState, type BattleQuestion, type BattleResult, type BattleSnapshot, type Reveal, type Scores } from "@/lib/battle-state";

type Settings = { playerName: string; subject: string; topic: string; questionCount: number };
type Command = "create" | "join" | "leave" | "rematch" | "invite";
const storageKey = (id: string) => `meow_active_battle_code:${id}`;
function remember(id: string, code: string | null) {
  try { if (code) localStorage.setItem(storageKey(id), code); else localStorage.removeItem(storageKey(id)); } catch { /* Storage is optional. Server recovery still works. */ }
}
function remembered(id: string) {
  try { return localStorage.getItem(storageKey(id)); } catch { return null; }
}

export function useBattle(token: string | null, userId: string) {
  const [state, dispatch] = useReducer(battleReducer, initialBattleState);
  const [connection, setConnection] = useState<"connecting" | "syncing" | "online" | "offline">("connecting");
  const [pending, setPending] = useState<Command | null>(null);
  const [inviteStatus, setInviteStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const pendingRef = useRef<Command | null>(null);
  const answerLock = useRef(false);
  const commandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishCommand = () => {
    pendingRef.current = null;
    setPending(null);
    if (commandTimer.current) clearTimeout(commandTimer.current);
  };

  useEffect(() => {
    if (!token || !userId) return;
    const socket = getSocket(token);
    let syncTimer: ReturnType<typeof setTimeout> | undefined;
    const clearAnswer = () => {
      answerLock.current = false;
      if (answerTimer.current) clearTimeout(answerTimer.current);
    };
    const sync = () => {
      setConnection("syncing");
      socket.emit("battle:resume", { code: remembered(userId) });
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        setConnection("offline");
        dispatch({ type: "error", message: "The battle server is taking too long. Reconnect to try again." });
      }, 12_000);
    };
    const online = () => { clearTimeout(syncTimer); setConnection("online"); finishCommand(); clearAnswer(); };
    const onDisconnect = () => { clearTimeout(syncTimer); setConnection("offline"); finishCommand(); clearAnswer(); };
    const onConnectError = () => {
      onDisconnect();
      dispatch({ type: "error", message: "Could not connect to the battle server. Check your connection and retry." });
    };
    const onCreated = (data: { code: string; playerName?: string; subject?: string; topic?: string; questionCount?: number }) => {
      finishCommand(); clearAnswer(); setInviteStatus(null); remember(userId, data.code);
      dispatch({ type: "created", ...data });
      dispatch({ type: "joined", ...data, players: data.playerName ? [data.playerName] : [] });
    };
    const onJoined = (data: { code?: string; players: string[]; subject?: string; topic?: string; questionCount?: number }) => {
      finishCommand();
      if (data.code) remember(userId, data.code);
      dispatch({ type: "joined", ...data });
    };
    const onRoomError = ({ message }: { message: string }) => { finishCommand(); dispatch({ type: "error", message }); };
    const onStart = () => { finishCommand(); clearAnswer(); dispatch({ type: "start" }); };
    const onQuestion = (question: BattleQuestion) => { clearAnswer(); dispatch({ type: "question", question }); };
    const onAnswer = (data: { questionIndex: number; isCorrect: boolean }) => {
      if (answerTimer.current) clearTimeout(answerTimer.current);
      dispatch({ type: "accepted", ...data });
    };
    const onRejected = (data: { reason: string; questionIndex?: number }) => {
      clearAnswer(); dispatch({ type: "rejected", ...data });
      sync();
    };
    const onScores = ({ scores }: { scores: Scores }) => dispatch({ type: "scores", scores });
    const onReveal = (reveal: Reveal) => { clearAnswer(); dispatch({ type: "reveal", reveal, userId }); };
    const onEnd = (result: BattleResult) => { finishCommand(); clearAnswer(); remember(userId, null); dispatch({ type: "end", result }); };
    const onResume = (snapshot: BattleSnapshot) => {
      online(); remember(userId, snapshot.code); dispatch({ type: "resume", snapshot, userId });
    };
    const onResumeResult = ({ reason }: { reason?: string }) => {
      clearTimeout(syncTimer);
      if (reason === "no-room") { online(); remember(userId, null); dispatch({ type: "reset" }); }
      else { setConnection("offline"); finishCommand(); dispatch({ type: "error", message: "Could not restore the match. Reconnect to try again." }); }
    };
    const onPresence = ({ reconnectDeadline }: { reconnectDeadline?: string }) => dispatch({ type: "presence", deadline: reconnectDeadline || null });
    const onReconnected = () => dispatch({ type: "presence", deadline: null });
    const onLeft = () => { finishCommand(); clearAnswer(); remember(userId, null); dispatch({ type: "reset" }); };
    const onClosed = ({ message }: { message?: string }) => { onLeft(); dispatch({ type: "error", message: message || "This room has closed. Create or join another room." }); };
    const onInvite = (result: { ok: boolean; message: string }) => { finishCommand(); setInviteStatus(result); };
    const onRematch = (result: { ok: boolean; message: string }) => { finishCommand(); if (!result.ok) dispatch({ type: "error", message: result.message }); };

    // Remove only this hook's listeners; notifications share the socket.
    socket.on("connect", sync).on("disconnect", onDisconnect).on("connect_error", onConnectError);
    socket.on("room:created", onCreated).on("room:joined", onJoined).on("room:error", onRoomError);
    socket.on("game:start", onStart).on("game:question", onQuestion).on("game:answerResult", onAnswer);
    socket.on("game:answerRejected", onRejected).on("game:scores", onScores).on("game:reveal", onReveal).on("game:end", onEnd);
    socket.on("battle:resumed", onResume).on("battle:resumeResult", onResumeResult);
    socket.on("room:playerDisconnected", onPresence).on("room:playerReconnected", onReconnected);
    socket.on("room:left", onLeft).on("room:closed", onClosed).on("room:inviteResult", onInvite).on("battle:rematchResult", onRematch);
    if (socket.connected) sync();
    return () => {
      clearTimeout(syncTimer);
      if (commandTimer.current) clearTimeout(commandTimer.current);
      if (answerTimer.current) clearTimeout(answerTimer.current);
      socket.off("connect", sync).off("disconnect", onDisconnect).off("connect_error", onConnectError);
      socket.off("room:created", onCreated).off("room:joined", onJoined).off("room:error", onRoomError);
      socket.off("game:start", onStart).off("game:question", onQuestion).off("game:answerResult", onAnswer);
      socket.off("game:answerRejected", onRejected).off("game:scores", onScores).off("game:reveal", onReveal).off("game:end", onEnd);
      socket.off("battle:resumed", onResume).off("battle:resumeResult", onResumeResult);
      socket.off("room:playerDisconnected", onPresence).off("room:playerReconnected", onReconnected);
      socket.off("room:left", onLeft).off("room:closed", onClosed).off("room:inviteResult", onInvite).off("battle:rematchResult", onRematch);
    };
  }, [token, userId]);

  const send = (command: Command, event: string, payload: object) => {
    if (!token || connection !== "online" || pendingRef.current) return;
    const socket = getSocket(token);
    if (!socket.connected) return;
    pendingRef.current = command; setPending(command); dispatch({ type: "error", message: "" });
    commandTimer.current = setTimeout(() => {
      finishCommand();
      dispatch({ type: "error", message: "No response received. Reconnecting to check your room…" });
      // Do not blindly retry a mutation that may already have succeeded.
      socket.disconnect().connect();
    }, 12_000);
    socket.emit(event, payload);
  };
  const submitAnswer = (index: number) => {
    const q = state.question;
    if (!token || !q || state.phase !== "playing" || state.answerStatus !== "idle" || answerLock.current || state.reveal || connection !== "online") return;
    if (q.deadline && Date.now() >= new Date(q.deadline).getTime()) {
      dispatch({ type: "rejected", reason: "deadline-expired", questionIndex: q.questionIndex });
      return;
    }
    const socket = getSocket(token);
    if (!socket.connected) return;
    answerLock.current = true; dispatch({ type: "select", index });
    socket.emit("game:answer", { code: state.code, questionIndex: q.questionIndex, selectedIndex: index });
    answerTimer.current = setTimeout(() => {
      setConnection("syncing");
      socket.disconnect().connect();
    }, 6_000);
  };
  return {
    state, connection, pending, inviteStatus,
    create: (settings: Settings) => send("create", "room:create", settings),
    join: (code: string, playerName: string) => send("join", "room:join", { code, playerName }),
    leave: () => send("leave", "room:leave", { code: state.code }),
    rematch: (playerName: string) => send("rematch", "battle:rematch", { rematchToken: state.result?.rematchToken, playerName }),
    invite: (email: string) => { setInviteStatus(null); send("invite", "room:invite", { code: state.code, email }); },
    reset: () => { remember(userId, null); setInviteStatus(null); dispatch({ type: "reset" }); },
    reconnect: () => { if (token) { setConnection("connecting"); getSocket(token).disconnect().connect(); } },
    submitAnswer,
  };
}

import { buildBattleQuestionSet } from './questionSetBuilder.js';
import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { createSocketPrincipal, SOCKET_AUTH_TTL_MS } from '../auth/socketPrincipal.js';
import { tracedSocketListener } from '../infrastructure/tracing.js';
import { registerBattleRelay } from "../infrastructure/battleOutbox.js";
import { finishBattle } from "./battleCompletion.js";
export { finishBattle, sendBattleResultNotifications } from "./battleCompletion.js";
// backend/battle/battleSocket.js
import { Server } from 'socket.io';
import { z } from 'zod';
import { createAdapter } from '@socket.io/mongo-adapter';
import {
  createRoom, joinRoom, getRoom, deleteRoom,
  setQuestions, submitAnswer, buildPublicQuestion,
  advanceQuestion, getScores, markSocketDisconnected, buildBattleReveal, claimBattleReveal,
  findResumableRoomForUser, resumePlayerConnection, buildBattleSnapshot,
  forfeitRoom, buildBattleReview, reserveRoomOpponent,
} from './roomManager.js';
import {
  getQuestionsCollection,
  getUsersCollection,
  getBattleFriendshipsCollection,
  getSocketIoAdapterCollection,
} from '../config/mongodb.js';
import { sendPushToUser } from '../services/pushNotificationService.js';
import {
  verifyToken,
  signBattleRematchToken,
  verifyBattleRematchToken,
} from '../auth/jwt.js';
import { setNotificationRealtimeServer } from '../services/notificationRealtime.js';
import { setBattleRealtimeServer } from './battleRealtime.js';
import { joinMatchmakingQueue, cancelMatchmakingQueue, getMatchmakingTicket } from './matchmakingService.js';
import { battleCodePattern, normalizeBattleCode } from './battleProtocol.js';
import { battleFailureMessage } from './battleLifecycle.js';
import { recordBattleIntegritySignal } from './battleIntegrityService.js';
import { canCreateBattle, canUseMatchmaking } from './battleFeatureGuards.js';

const REVEAL_DELAY  = 5000; // ms to show results before next question (5 sec timer)
const advanceTimers = new WeakMap();
function scheduleAdvance(io, code, index, delay) {
  const timers = advanceTimers.get(io);
  if (!timers) return; // Closed instances leave recovery to the durable worker.
  const timer = setTimeout(() => {
    timers.delete(timer);
    void advanceBattleAfterAnswers(io, code, index).catch(error => runtimeLog.error('Battle advance failed:', error));
  }, delay);
  timer.unref();
  timers.add(timer);
}
const ROOM_CREATE_COOLDOWN_MS = 10_000; // per-socket room creation throttle
const answerBase = {
  code: z.string().transform(normalizeBattleCode).pipe(z.string().regex(battleCodePattern)),
  questionIndex: z.number().int().min(0).max(500),
};
const answerPayloadSchema = z.union([
  z.object({ ...answerBase, type: z.literal('mcq').optional(), selectedIndex: z.number().int().min(0).max(19) }).strict(),
  z.object({ ...answerBase, type: z.literal('msq'), selectedIndices: z.array(z.number().int().min(0).max(19)).min(1).max(20) }).strict(),
  z.object({ ...answerBase, type: z.literal('nat'), numericAnswer: z.number().finite() }).strict(),
]);
const matchmakingSchema = z.object({ subject: z.enum(["mathematics", "reasoning", "english", "general-awareness", "iit-jam-physics"]), topic: z.string().min(1).max(80), questionCount: z.union([z.literal(10), z.literal(15), z.literal(25), z.literal(50)]) });
const socialChallengeSchema = z.object({ targetUserId: z.string().min(1).max(200), subject: z.enum(["mathematics", "reasoning", "english", "general-awareness", "iit-jam-physics"]), topic: z.string().min(1).max(80), questionCount: z.union([z.literal(10), z.literal(15), z.literal(25), z.literal(50)]) });

export function initBattleSocket(httpServer, corsOrigin, adapterFactory = null) {
  // Build an explicit origin allowlist for Socket.IO.
  // Always includes the production Vercel frontend + localhost for dev.
  // Falls back to the shared corsOrigin function if no FRONTEND_URL is set.
  const socketCorsOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];

  const io = new Server(httpServer, {
    cors: {
      origin: socketCorsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false,
    },
  });
  advanceTimers.set(io, new Set());
  httpServer.once?.('close', () => {
    for (const timer of advanceTimers.get(io) || []) clearTimeout(timer);
    advanceTimers.delete(io);
  });

  io.adapter(adapterFactory || createAdapter(getSocketIoAdapterCollection(), {
    addCreatedAtField: true,
  }));

  runtimeLog.info(`Socket.IO ${adapterFactory ? 'Redis Streams' : 'MongoDB'} adapter enabled ✅`);

  registerBattleRelay(io);
  setBattleRealtimeServer(io);

  setNotificationRealtimeServer(io);

  // ── Socket authentication ─────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.authorization = createSocketPrincipal(verifyToken(token), { onInvalidated: () => socket.disconnect(true) });
      socket.user = await socket.authorization.get();
      next();
    } catch {
      socket.authorization?.close();
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const revalidate = setInterval(() => {
      void socket.authorization.get().then(user => { socket.user = user; }).catch(() => socket.disconnect(true));
    }, SOCKET_AUTH_TTL_MS);
    revalidate.unref();
    socket.once('disconnect', () => { clearInterval(revalidate); socket.authorization.close(); });
    const onEvent = (event, listener) => socket.on(event, tracedSocketListener(socket, event, listener));
    socket.use(async (_packet, next) => {
      try {
        socket.user = await socket.authorization.get();
        next();
      } catch {
        next(new Error('Session expired'));
        socket.disconnect(true);
      }
    });
    runtimeLog.info(`Socket connected: ${socket.id} (user: ${socket.user?.email || socket.user?.id})`);

    const userRoom = `user:${String(socket.user.id)}`;
    socket.join(userRoom);
    const recordActive = () => getUsersCollection().updateOne({ id: String(socket.user.id) }, { $max: { battleLastActiveAt: new Date() } }).catch(runtimeLog.error);
    void recordActive();
    if (socket.user.sid) socket.join(`session:${socket.user.sid}`);

    let lastRoomCreateTime = 0;
    let lastInviteTime = 0;
    let lastRematchTime = 0;
    let lastAnswerEventAt = 0;
    onEvent('matchmaking:join', async (raw) => {
      if (!canUseMatchmaking(socket.user.id)) return socket.emit('matchmaking:error', { code: 'MATCHMAKING_UNAVAILABLE', message: 'Matchmaking is temporarily unavailable.' });
      const parsed = matchmakingSchema.safeParse(raw);
      if (!parsed.success) return socket.emit('matchmaking:error', { message: 'Invalid matchmaking settings.' });
      try {
        const ticket = await joinMatchmakingQueue({
          userId: socket.user.id,
          displayName: socket.user.name || socket.user.email || 'Player',
          ...parsed.data,
        });
        io.to(userRoom).emit('matchmaking:queued', {
          queuedAt: ticket.queuedAt, rating: ticket.rating,
          subject: ticket.subject, topic: ticket.topic, questionCount: ticket.questionCount,
        });
      } catch (error) {
        runtimeLog.error('matchmaking:join:', error);
        socket.emit('matchmaking:error', { message: battleFailureMessage(error, 'Could not enter matchmaking. Please try again.') });
      }
    });
    onEvent('matchmaking:cancel', async () => {
      try {
        if (await cancelMatchmakingQueue(socket.user.id)) io.to(userRoom).emit('matchmaking:cancelled');
        else socket.emit('matchmaking:error', { code: 'RESUME_REQUIRED', message: 'Checking your current match…' });
      } catch (error) { runtimeLog.error(error); socket.emit('matchmaking:error', { message: 'Could not cancel matchmaking. Please reconnect.' }); }
    });
    onEvent('battle:challengeUser', async (raw) => {
      if (!canCreateBattle(socket.user.id)) return socket.emit('room:error', { message: 'New battles are temporarily unavailable.' });
      const parsed = socialChallengeSchema.safeParse(raw);
      if (!parsed.success || parsed.data.targetUserId === socket.user.id) return socket.emit('room:error', { message: 'Invalid battle invitation.' });
      if (Date.now() - lastRoomCreateTime < ROOM_CREATE_COOLDOWN_MS) return socket.emit('room:error', { message: 'Please wait before sending another invitation.' });
      lastRoomCreateTime = Date.now();
      try {
        const { targetUserId, subject, topic, questionCount } = parsed.data;
        const target = await getUsersCollection().findOne({ id: targetUserId, status: { $nin: ['banned', 'suspended'] } }, { projection: { id: 1 } });
        if (!target) return socket.emit('room:error', { message: 'This student is unavailable.' });
        const friendship = await getBattleFriendshipsCollection().findOne({ users: { $all: [String(socket.user.id), targetUserId] }, status: 'accepted' });
        if (!friendship) return socket.emit('room:error', { message: 'Add this student as a friend before inviting them to battle.' });
        const code = await createRoom(socket.id, socket.user.name || 'Player', subject, topic, questionCount, socket.user.id, { origin: 'social', allowedOpponentUserId: targetUserId });
        socket.join(code);
        const payload = {
          roomCode: code,
          challenger: { userId: socket.user.id, name: socket.user.name || 'Player' },
          subject, topic, questionCount,
        };
        io.to(`user:${targetUserId}`).emit('battle:challengeReceived', payload);
        void sendPushToUser(targetUserId, {
          title: `${payload.challenger.name} challenged you ⚔️`,
          body: `Join the ${subject} battle.`, route: `/battle?join=${code}`,
          category: 'battleInvites',
          data: { type: 'battle_invite', roomCode: code, challengerUserId: socket.user.id },
          centerKey: `social-battle:${code}:${targetUserId}`,
        }).catch(runtimeLog.error);
        socket.emit('battle:challengeSent', { roomCode: code, targetUserId });
        socket.emit('room:created', { code, playerName: payload.challenger.name, subject, topic, questionCount });
      } catch (error) {
        runtimeLog.error('battle:challengeUser:', error);
        socket.emit('room:error', { message: battleFailureMessage(error, 'Could not send challenge.') });
      }
    });

    onEvent('battle:resume', async ({ code = null } = {}) => {
      try {
        const userId = String(socket.user?.id || '');
        if (!userId) return;
        const room = await findResumableRoomForUser(userId, code);
        if (!room) {
          const ticket = await getMatchmakingTicket(userId);
          if (ticket) { socket.emit('matchmaking:queued', { queuedAt: ticket.queuedAt, rating: ticket.rating, subject: ticket.subject, topic: ticket.topic, questionCount: ticket.questionCount }); return; }
          socket.emit('battle:resumeResult', { ok: false, reason: 'no-room' });
          return;
        }
        const resumed = await resumePlayerConnection({ code: room.code, userId, socketId: socket.id });
        if (!resumed) {
          socket.emit('battle:resumeResult', { ok: false, reason: 'resume-failed' });
          return;
        }
        const latestRoom = resumed.room;
        socket.join(latestRoom.code);
        const oldSocketId = resumed.previousSocketId;
        if (oldSocketId && oldSocketId !== socket.id) {
          await io.in(oldSocketId).disconnectSockets(true);
        }
        const snapshot = buildBattleSnapshot(latestRoom, userId);
        const opponent = latestRoom.players.find((player) => player.userId !== userId);
        const rematchToken = latestRoom.status === 'finished' && opponent
          ? signBattleRematchToken({
              requesterUserId: userId,
              opponentUserId: opponent.userId,
              opponentName: opponent.name,
              subject: latestRoom.subject,
              topic: latestRoom.topic,
              questionCount: latestRoom.questionCount,
            })
          : null;
        socket.emit('battle:resumed', {
          ...snapshot,
          rematchToken,
          opponentName: opponent?.name || 'Opponent',
        });
        socket.to(latestRoom.code).emit('room:playerReconnected', {
          userId,
          name: latestRoom.players.find((player) => player.userId === userId)?.name || 'Opponent',
        });
        if (latestRoom.status === 'waiting' && latestRoom.players.length === 2) {
          void startGame(io, latestRoom.code).catch((error) => {
            runtimeLog.error('Resume startGame repair failed:', error);
          });
        }
        if (latestRoom.status === 'active') {
          void repairAnsweredBattle(io, latestRoom);
        }
      } catch (error) {
        runtimeLog.error('battle:resume failed:', error);
        socket.emit('battle:resumeResult', { ok: false, reason: 'server-error' });
      }
    });

    // ── Create room ──────────────────────────────────────
    onEvent('room:create', async ({ playerName, subject = 'mathematics', topic = 'all', questionCount = 10 }) => {
      if (!canCreateBattle(socket.user.id)) return socket.emit('room:error', { message: 'New battles are temporarily unavailable.' });
      const now = Date.now();
      if (now - lastRoomCreateTime < ROOM_CREATE_COOLDOWN_MS) {
        socket.emit('room:error', { message: 'Please wait before creating another room.' });
        return;
      }
      lastRoomCreateTime = now;

      const parsed = matchmakingSchema.safeParse({ subject, topic, questionCount });
      if (!parsed.success) return socket.emit('room:error', { message: 'Invalid battle settings.' });
      try {
        const code = await createRoom(socket.id, playerName, subject, topic, questionCount, socket.user?.id);
        socket.join(code);
        socket.emit('room:created', { code, playerName, subject, topic, questionCount });
        runtimeLog.info(`Room ${code} created by ${playerName}`);
      } catch (error) { socket.emit('room:error', { message: battleFailureMessage(error, 'Could not create room.') }); }
    });

    // Waiting-room cancellation is explicit so a cancelled room is not
    // immediately restored by battle:resume on the next connection.
    // In active rooms, leaving forfeits the match and grants the opponent an instant win.
    onEvent('room:leave', async ({ code } = {}) => {
      const normalizedCode = normalizeBattleCode(code);
      const room = battleCodePattern.test(normalizedCode) ? await getRoom(normalizedCode) : null;
      const userId = String(socket.user?.id || '');
      if (!room || !room.players.some((player) => player.userId === userId)) {
        socket.emit('room:left');
        return;
      }
      if (room.status === 'active') {
        const finishedRoom = await forfeitRoom(normalizedCode, userId);
        if (finishedRoom) {
          socket.leave(normalizedCode);
          socket.emit('room:left');
          await finishBattle(io, finishedRoom);
          return;
        }
      }
      if (room.status !== 'waiting') {
        socket.emit('room:error', { message: 'An active battle cannot be cancelled. Reconnect to finish the match.' });
        return;
      }
      await deleteRoom(normalizedCode);
      socket.leave(normalizedCode);
      io.to(normalizedCode).emit('room:closed', { message: 'The host cancelled this battle room.' });
      socket.emit('room:left');
    });

    onEvent('game:forfeit', async ({ code } = {}) => {
      const normalizedCode = normalizeBattleCode(code);
      const userId = String(socket.user?.id || '');
      const finishedRoom = await forfeitRoom(normalizedCode, userId);
      if (!finishedRoom) return;
      socket.emit('room:left');
      await finishBattle(io, finishedRoom);
    });

    // ── Invite opponent ──────────────────────────────────
    onEvent('room:invite', async ({ code, email }) => {
      const now = Date.now();
      if (now - lastInviteTime < 10000) {
        socket.emit('room:inviteResult', {
          ok: false,
          message: 'Please wait before sending another invite.',
        });
        return;
      }
      lastInviteTime = now;

      const normalizedCode = normalizeBattleCode(code);
      const normalizedEmail = String(email ?? '').trim().toLowerCase();

      if (!battleCodePattern.test(normalizedCode) || !normalizedEmail || normalizedEmail.length > 254) {
        socket.emit('room:inviteResult', {
          ok: false,
          message: 'Invalid room code or email address.',
        });
        return;
      }

      const room = await getRoom(normalizedCode);
      if (!room || room.status !== 'waiting') {
        socket.emit('room:inviteResult', {
          ok: false,
          message: 'Battle room is no longer waiting for players.',
        });
        return;
      }

      if (room.ownerUserId !== socket.user?.id) {
        socket.emit('room:inviteResult', {
          ok: false,
          message: 'Only the room host can invite opponents.',
        });
        return;
      }

      if (normalizedEmail === String(socket.user?.email || '').trim().toLowerCase()) {
        socket.emit('room:inviteResult', {
          ok: false,
          message: 'You cannot invite yourself.',
        });
        return;
      }

      try {
        const usersCollection = getUsersCollection();
        const recipient = await usersCollection.findOne({
          email: normalizedEmail,
          type: { $ne: 'email_lock' },
        });

        if (!recipient || ['suspended', 'banned'].includes(recipient.status)) {
          socket.emit('room:inviteResult', {
            ok: false,
            message: 'Invite could not be delivered.',
          });
          return;
        }

        const hostName = String(
          socket.user?.name || room.players?.find((player) => player.userId === socket.user?.id)?.name || 'A player'
        ).slice(0, 40);

        const recipientUserId = recipient.id || String(recipient._id);
        if (!await reserveRoomOpponent(normalizedCode, socket.user.id, recipientUserId)) {
          socket.emit('room:inviteResult', { ok: false, message: 'This room is already reserved or is no longer available.' });
          return;
        }
        const result = await sendPushToUser(recipientUserId, {
          title: `${hostName} challenged you ⚔️`,
          body: `Join the ${room.subject || 'quiz'} battle now.`,
          route: `/battle?join=${normalizedCode}`,
          category: 'battleInvites',
          data: {
            type: 'battle_invite',
            roomCode: normalizedCode,
            hostUserId: String(socket.user?.id || ''),
          },
          centerKey: `battle-invite:${normalizedCode}:${recipient.id || String(recipient._id)}`,
        });

        if (result?.noDevices || result?.successCount === 0) {
          socket.emit('room:inviteResult', {
            ok: false,
            message: 'Invite could not be delivered.',
          });
          return;
        }

        socket.emit('room:inviteResult', {
          ok: true,
          message: 'Battle invite sent!',
        });
      } catch (err) {
        runtimeLog.error('room:invite error:', err.message);
        socket.emit('room:inviteResult', {
          ok: false,
          message: 'Failed to send battle invite.',
        });
      }
    });

    // ── Rematch ──────────────────────────────────────────
    onEvent('battle:rematch', async ({ rematchToken, playerName }) => {
      try {
        if (!canCreateBattle(socket.user.id)) {
          socket.emit('battle:rematchResult', { ok: false, message: 'New battles are temporarily unavailable.' });
          return;
        }
        if (Date.now() - lastRematchTime < 10_000) {
          socket.emit('battle:rematchResult', {
            ok: false,
            message: 'Please wait before requesting another rematch.',
          });
          return;
        }

        const payload = verifyBattleRematchToken(rematchToken);

        if (payload.requesterUserId !== socket.user?.id) {
          throw new Error('Invalid rematch owner');
        }

        lastRematchTime = Date.now();

        const safePlayerName = String(playerName || socket.user?.name || 'A player').trim();

        const code = await createRoom(
          socket.id,
          safePlayerName,
          payload.subject,
          payload.topic,
          payload.questionCount,
          socket.user?.id,
          { origin: 'rematch', allowedOpponentUserId: payload.opponentUserId }
        );

        socket.join(code);

        socket.emit('room:created', {
          code,
          playerName: safePlayerName,
        });

        const pushResult = await sendPushToUser(payload.opponentUserId, {
          title: `${safePlayerName} wants a rematch ⚔️`,
          body: 'Think you can win this time?',
          route: `/battle?join=${code}`,
          category: 'battleInvites',
          data: {
            type: 'battle_rematch',
            roomCode: code,
          },
        });

        socket.emit('battle:rematchResult', {
          ok: !pushResult?.noDevices && (pushResult?.successCount || 0) > 0,
          code,
          message:
            (pushResult?.successCount || 0) > 0
              ? 'Rematch invite sent!'
              : 'Room created, but push could not be delivered.',
        });
      } catch (error) {
        runtimeLog.error('Rematch error:', error);
        socket.emit('battle:rematchResult', {
          ok: false,
          message: 'Rematch request is invalid or expired.',
        });
      }
    });

    // ── Join room ────────────────────────────────────────
    onEvent('room:join', async ({ code, playerName }) => {
      const normalizedCode = normalizeBattleCode(code);
      if (!battleCodePattern.test(normalizedCode)) {
        socket.emit('room:error', { message: 'Enter a valid room code.' });
        return;
      }
      let result;
      try { result = await joinRoom(normalizedCode, socket.id, playerName, socket.user?.id); }
      catch (error) { runtimeLog.error('room:join:', error); socket.emit('room:error', { message: 'Could not join this room. Please try again.' }); return; }

      if (result.error) {
        socket.emit('room:error', { message: result.error });
        return;
      }

      socket.join(normalizedCode);

      // Notify both players of updated player list
      io.to(normalizedCode).emit('room:joined', {
        players: result.room.players.map((player) => player.name),
        code: normalizedCode,
        subject: result.room.subject,
        topic: result.room.topic,
        questionCount: result.room.questionCount,
      });

      // Both players present — start the game
      await startGame(io, normalizedCode);
    });

    // ── Submit answer ────────────────────────────────────
    onEvent('game:answer', async (rawPayload) => {
      if (Date.now() - lastAnswerEventAt < 150) return;
      lastAnswerEventAt = Date.now();
      const parsed = answerPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        void recordBattleIntegritySignal({ dedupeKey: `invalid-answer-payload:${socket.user.id}:${new Date().toISOString().slice(0, 10)}`, userId: socket.user.id, signalType: 'invalid-answer-payload', severity: 'low', riskPoints: 5, details: { socketId: socket.id } }).catch(runtimeLog.error);
        socket.emit('game:answerRejected', { reason: 'invalid-payload' });
        return;
      }
      const { code, questionIndex } = parsed.data;
      let result;
      try {
        result = await submitAnswer({ ...parsed.data, userId: socket.user.id });
      } catch (error) {
        runtimeLog.error('Battle answer persistence failed:', error);
        socket.emit('game:answerRejected', { reason: 'server-error', questionIndex });
        return;
      }
      if (!result.ok) {
        if (result.reason === 'invalid-option') void recordBattleIntegritySignal({ dedupeKey: `invalid-option:${socket.user.id}:${new Date().toISOString().slice(0, 10)}`, userId: socket.user.id, roomCode: code, signalType: 'invalid-option-attempt', severity: 'medium', riskPoints: 15 }).catch(runtimeLog.error);
        socket.emit('game:answerRejected', { reason: result.reason, questionIndex });
        return;
      }

      socket.emit('game:answerResult', { questionIndex, accepted: true });
      io.to(code).emit('game:opponentAnswered', { questionIndex, userId: socket.user.id, answered: true });
      if (result.reveal) {
        const currentIdx = result.reveal.questionIndex;
        io.to(code).emit('game:reveal', result.reveal);
        scheduleAdvance(io, code, currentIdx, REVEAL_DELAY);
      }
    });

    // ── Disconnect ───────────────────────────────────────
    onEvent('disconnect', async (reason) => {
      void recordActive();
      try {
        const found = await markSocketDisconnected(socket.id, {
          deployment: reason === 'server shutting down',
        });
        if (found && found.status === 'active') {
          socket.to(found.code).emit('room:playerDisconnected', {
            userId: found.userId,
            name: found.name,
            reconnectDeadline: found.reconnectDeadline?.toISOString(),
            graceMs: found.graceMs,
          });
        }
      } catch (error) {
        runtimeLog.error('Battle disconnect persistence failed:', error);
      }
      runtimeLog.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

async function repairAnsweredBattle(io, room) {
  if (room.status !== 'active' || room.players.length !== 2 || !room.players.every((player) => player.answered)) return;
  const claimed = await claimBattleReveal(room.code, room.currentIndex);
  const latest = claimed || room;
  const reveal = buildBattleReveal(latest);
  if (reveal) io.to(room.code).emit('game:reveal', reveal);
  const expectedIndex = room.currentIndex;
  scheduleAdvance(io, room.code, expectedIndex,
    Math.max(0, new Date(latest.questionAdvanceAt || Date.now() + REVEAL_DELAY).getTime() - Date.now()));
}

async function advanceBattleAfterAnswers(io, code, expectedIndex) {
  const transition = await advanceQuestion(code, expectedIndex);
  if (!transition?.advanced) return;
  if (!transition.finished) {
    const room = transition.room;
    io.to(code).emit('game:question', buildPublicQuestion(room));
    return;
  }
  await finishBattle(io, transition.room);
}

// ── Fetch questions and start game ───────────────────────
async function startGame(io, code) {
  const room = await getRoom(code);
  if (!room || room.status !== 'waiting' || room.players.length !== 2 || (room.origin === 'matchmaking' && room.players.some(player => player.connected === false))) return;

  try {
    const questions = getQuestionsCollection();

    const { questions: shuffled, ...selection } = await buildBattleQuestionSet(questions, room);
    if (!shuffled.length) {
      io.to(code).emit('room:error', { message: 'No playable questions found for this battle. Try another topic.' });
      await deleteRoom(code);
      io.to(code).emit('room:closed', { message: 'No playable questions found. Try another topic.' });
      return;
    }

    const activeRoom = await setQuestions(code, shuffled, selection);
    if (!activeRoom) return;

    io.to(code).emit('game:start', {
      message: 'Battle started!',
      total: shuffled.length,
      topic: activeRoom.topic,
      mode: activeRoom.mode, rated: activeRoom.rated, origin: activeRoom.origin,
      scores: await getScores(code),
    });

    io.to(code).emit('game:question', buildPublicQuestion(activeRoom));

  } catch (err) {
    runtimeLog.error(
      'startGame error:',
      err.message
    );

    await deleteRoom(code);
    io.to(code).emit('room:closed', { message: battleFailureMessage(err, 'Failed to load questions. Try again.') });
  }
}

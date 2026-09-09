import { registerBattleRelay } from "../infrastructure/battleOutbox.js";
import { finishBattle } from "./battleCompletion.js";
export { finishBattle, sendBattleResultNotifications } from "./battleCompletion.js";
// backend/battle/battleSocket.js
import { Server } from 'socket.io';
import { z } from 'zod';
import { createAdapter } from '@socket.io/mongo-adapter';
import {
  createRoom, joinRoom, getRoom, deleteRoom,
  setQuestions, submitAnswer,
  advanceQuestion, getScores, markSocketDisconnected, getCorrectAnswerIndex,
  findResumableRoomForUser, resumePlayerConnection, buildBattleSnapshot,
  forfeitRoom, buildBattleReview,
} from './roomManager.js';
import {
  getQuestionsCollection,
  getUsersCollection,
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
import { joinMatchmakingQueue, cancelMatchmakingQueue } from './matchmakingService.js';
import { recordBattleIntegritySignal } from './battleIntegrityService.js';
import { canCreateBattle, canUseMatchmaking } from './battleFeatureGuards.js';

function normalizeSearchKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function matchesNormalizedTopic(question, normalizedTopic) {
  const candidates = [
    question.topic,
    question.chapter,
    question.subject,
    question.quizTopic,
    question.quizName,
    question.source,
  ];
  return candidates.some((field) => normalizeSearchKey(field) === normalizedTopic);
}

const REVEAL_DELAY  = 5000; // ms to show results before next question (5 sec timer)
const ROOM_CREATE_COOLDOWN_MS = 10_000; // per-socket room creation throttle
const answerPayloadSchema = z.object({
  code: z.string().regex(/^\d{4}$/),
  questionIndex: z.number().int().min(0).max(500),
  selectedIndex: z.number().int().min(0).max(20),
});
const matchmakingSchema = z.object({ subject: z.enum(["mathematics", "reasoning", "english", "general-awareness"]), topic: z.string().min(1).max(80), questionCount: z.union([z.literal(10), z.literal(15), z.literal(25), z.literal(50)]) });
const socialChallengeSchema = z.object({ targetUserId: z.string().min(1).max(200), subject: z.enum(["mathematics", "reasoning", "english", "general-awareness"]), topic: z.string().min(1).max(80), questionCount: z.union([z.literal(10), z.literal(15), z.literal(25), z.literal(50)]) });

export function initBattleSocket(httpServer, corsOrigin) {
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

  io.adapter(createAdapter(getSocketIoAdapterCollection(), {
    addCreatedAtField: true,
  }));

  console.log('Socket.IO MongoDB adapter enabled ✅');

  registerBattleRelay(io);
  setBattleRealtimeServer(io);

  setNotificationRealtimeServer(io);

  // ── Socket authentication ─────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user?.email || socket.user?.id})`);

    const userRoom = `user:${String(socket.user.id)}`;
    socket.join(userRoom);

    let lastRoomCreateTime = 0;
    let lastInviteTime = 0;
    let lastRematchTime = 0;
    let lastAnswerEventAt = 0;
    socket.on('matchmaking:join', async (raw) => {
      if (!canUseMatchmaking(socket.user.id)) return socket.emit('matchmaking:error', { code: 'MATCHMAKING_UNAVAILABLE', message: 'Matchmaking is temporarily unavailable.' });
      const parsed = matchmakingSchema.safeParse(raw);
      if (!parsed.success) return socket.emit('matchmaking:error', { message: 'Invalid matchmaking settings.' });
      try { const ticket = await joinMatchmakingQueue({ userId: socket.user.id, displayName: socket.user.name || socket.user.email || 'Player', ...parsed.data }); socket.emit('matchmaking:queued', { queuedAt: ticket.queuedAt, rating: ticket.rating, subject: ticket.subject, topic: ticket.topic, questionCount: ticket.questionCount }); }
      catch (error) { console.error('matchmaking:join:', error); socket.emit('matchmaking:error', { message: 'Could not enter matchmaking.' }); }
    });
    socket.on('matchmaking:cancel', async () => { await cancelMatchmakingQueue(socket.user.id).catch(console.error); socket.emit('matchmaking:cancelled'); });
    socket.on('battle:challengeUser', async (raw) => {
      if (!canCreateBattle(socket.user.id)) return socket.emit('room:error', { message: 'New battles are temporarily unavailable.' });
      const parsed = socialChallengeSchema.safeParse(raw); if (!parsed.success || parsed.data.targetUserId === socket.user.id) return;
      try { const { targetUserId, subject, topic, questionCount } = parsed.data, code = await createRoom(socket.id, socket.user.name || 'Player', subject, topic, questionCount, socket.user.id); socket.join(code); const payload = { roomCode: code, challenger: { userId: socket.user.id, name: socket.user.name || 'Player' }, subject, topic, questionCount }; io.to(`user:${targetUserId}`).emit('battle:challengeReceived', payload); void sendPushToUser(targetUserId, { title: `${payload.challenger.name} challenged you ⚔️`, body: `Join the ${subject} battle.`, route: `/battle?join=${code}`, category: 'battleInvites', data: { type: 'battle_invite', roomCode: code, challengerUserId: socket.user.id }, centerKey: `social-battle:${code}:${targetUserId}` }).catch(console.error); socket.emit('battle:challengeSent', { roomCode: code, targetUserId }); }
      catch (error) { console.error('battle:challengeUser:', error); socket.emit('room:error', { message: 'Could not send challenge.' }); }
    });

    socket.on('battle:resume', async ({ code = null } = {}) => {
      try {
        const userId = String(socket.user?.id || '');
        if (!userId) return;
        const room = await findResumableRoomForUser(userId, code);
        if (!room) {
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
            console.error('Resume startGame repair failed:', error);
          });
        }
        if (latestRoom.status === 'active') {
          void repairAnsweredBattle(io, latestRoom);
        }
      } catch (error) {
        console.error('battle:resume failed:', error);
        socket.emit('battle:resumeResult', { ok: false, reason: 'server-error' });
      }
    });

    // ── Create room ──────────────────────────────────────
    socket.on('room:create', async ({ playerName, subject = 'mathematics', topic = 'all', questionCount = 10 }) => {
      if (!canCreateBattle(socket.user.id)) return socket.emit('room:error', { message: 'New battles are temporarily unavailable.' });
      const now = Date.now();
      if (now - lastRoomCreateTime < ROOM_CREATE_COOLDOWN_MS) {
        socket.emit('room:error', { message: 'Please wait before creating another room.' });
        return;
      }
      lastRoomCreateTime = now;

      const code = await createRoom(socket.id, playerName, subject, topic, questionCount, socket.user?.id);
      socket.join(code);
      socket.emit('room:created', { code, playerName, subject, topic, questionCount });
      console.log(`Room ${code} created by ${playerName}`);
    });

    // Waiting-room cancellation is explicit so a cancelled room is not
    // immediately restored by battle:resume on the next connection.
    // In active rooms, leaving forfeits the match and grants the opponent an instant win.
    socket.on('room:leave', async ({ code } = {}) => {
      const normalizedCode = String(code ?? '').replace(/\D/g, '').slice(0, 4);
      const room = normalizedCode.length === 4 ? await getRoom(normalizedCode) : null;
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

    socket.on('game:forfeit', async ({ code } = {}) => {
      const normalizedCode = String(code ?? '').replace(/\D/g, '').slice(0, 4);
      const userId = String(socket.user?.id || '');
      const finishedRoom = await forfeitRoom(normalizedCode, userId);
      if (!finishedRoom) return;
      socket.emit('room:left');
      await finishBattle(io, finishedRoom);
    });

    // ── Invite opponent ──────────────────────────────────
    socket.on('room:invite', async ({ code, email }) => {
      const now = Date.now();
      if (now - lastInviteTime < 10000) {
        socket.emit('room:inviteResult', {
          ok: false,
          message: 'Please wait before sending another invite.',
        });
        return;
      }
      lastInviteTime = now;

      const normalizedCode = String(code ?? '').replace(/\D/g, '').slice(0, 4);
      const normalizedEmail = String(email ?? '').trim().toLowerCase();

      if (normalizedCode.length !== 4 || !normalizedEmail || normalizedEmail.length > 254) {
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

      if (room.ownerUserId && room.ownerUserId !== socket.user?.id) {
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
        console.error('room:invite error:', err.message);
        socket.emit('room:inviteResult', {
          ok: false,
          message: 'Failed to send battle invite.',
        });
      }
    });

    // ── Rematch ──────────────────────────────────────────
    socket.on('battle:rematch', async ({ rematchToken, playerName }) => {
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
          socket.user?.id
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
        console.error('Rematch error:', error);
        socket.emit('battle:rematchResult', {
          ok: false,
          message: 'Rematch request is invalid or expired.',
        });
      }
    });

    // ── Join room ────────────────────────────────────────
    socket.on('room:join', async ({ code, playerName }) => {
      const normalizedCode = String(code ?? '').replace(/\D/g, '').slice(0, 4);
      if (normalizedCode.length !== 4) {
        socket.emit('room:error', { message: 'Enter 4-digit room code' });
        return;
      }
      const result = await joinRoom(normalizedCode, socket.id, playerName, socket.user?.id);

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
    socket.on('game:answer', async (rawPayload) => {
      if (Date.now() - lastAnswerEventAt < 150) return;
      lastAnswerEventAt = Date.now();
      const parsed = answerPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        void recordBattleIntegritySignal({ dedupeKey: `invalid-answer-payload:${socket.user.id}:${new Date().toISOString().slice(0, 10)}`, userId: socket.user.id, signalType: 'invalid-answer-payload', severity: 'low', riskPoints: 5, details: { socketId: socket.id } }).catch(console.error);
        socket.emit('game:answerRejected', { reason: 'invalid-payload' });
        return;
      }
      const { code, questionIndex, selectedIndex } = parsed.data;
      let result;
      try {
        result = await submitAnswer({ code, userId: socket.user.id, questionIndex, selectedIndex });
      } catch (error) {
        console.error('Battle answer persistence failed:', error);
        socket.emit('game:answerRejected', { reason: 'server-error', questionIndex });
        return;
      }
      if (!result.ok) {
        if (result.reason === 'invalid-option') void recordBattleIntegritySignal({ dedupeKey: `invalid-option:${socket.user.id}:${new Date().toISOString().slice(0, 10)}`, userId: socket.user.id, roomCode: code, signalType: 'invalid-option-attempt', severity: 'medium', riskPoints: 15 }).catch(console.error);
        socket.emit('game:answerRejected', { reason: result.reason, questionIndex });
        return;
      }

      // Tell THIS player their result immediately
      socket.emit('game:answerResult', { questionIndex, isCorrect: result.isCorrect });

      // Tell OPPONENT what this player answered
      const room = await getRoom(code);
      const opponent = room?.players.find(
        (player) => player.userId !== socket.user.id
      );
      if (opponent?.socketId) {
        io.to(opponent.socketId).emit('game:opponentAnswer', { selectedIndex });
      }

      // Broadcast updated scores (includes answered flag)
      io.to(code).emit('game:scores', { scores: result.scores });

      // Move to next question only when BOTH answered
      if (result.allAnswered) {
        const revealRoom = await getRoom(code);
        if (!revealRoom) return;
        const currentIdx = revealRoom.currentIndex ?? questionIndex;
        io.to(code).emit('game:reveal', {
          questionIndex: currentIdx,
          correctIndex: getCorrectAnswerIndex(revealRoom.questions[currentIdx]),
          selections: Object.fromEntries(revealRoom.players.map((player) => [player.userId, player.selectedIndex ?? null])),
          revealEndsAt: new Date(Date.now() + REVEAL_DELAY).toISOString(),
        });
        setTimeout(() => {
          void advanceBattleAfterAnswers(io, code, currentIdx)
            .catch((error) => console.error('Battle advance failed:', error));
        }, REVEAL_DELAY);
      }
    });

    // ── Disconnect ───────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      void cancelMatchmakingQueue(socket.user.id).catch((error) => console.error('Matchmaking disconnect cleanup:', error));
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
        console.error('Battle disconnect persistence failed:', error);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

async function repairAnsweredBattle(io, room) {
  if (room.status !== 'active' || room.players.length !== 2 || !room.players.every((player) => player.answered)) return;
  const expectedIndex = room.currentIndex;
  setTimeout(() => {
    void advanceBattleAfterAnswers(io, room.code, expectedIndex)
      .catch((error) => console.error('Battle recovery advance failed:', error));
  }, REVEAL_DELAY);
}

async function advanceBattleAfterAnswers(io, code, expectedIndex) {
  const transition = await advanceQuestion(code, expectedIndex);
  if (!transition?.advanced) return;
  if (!transition.finished) {
    const room = transition.room;
    const question = room.questions[room.currentIndex];
    io.to(code).emit('game:question', {
      question: question.question,
      options: question.options,
      questionIndex: room.currentIndex,
      total: room.questions.length,
      deadline: room.questionDeadline,
    });
    return;
  }
  await finishBattle(io, transition.room);
}

// ── Fetch questions and start game ───────────────────────
async function startGame(io, code) {
  const room = await getRoom(code);
  if (!room) return;

  try {
    const questions = getQuestionsCollection();

    const mongoFilter = {};

    // Preserve previous case-insensitive exact subject match
    if (room.subject) {
      mongoFilter.subject = {
        $regex: `^${String(room.subject)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        $options: 'i',
      };
    }

    const normalizedTopic =
      room.topic && room.topic !== 'all'
        ? normalizeSearchKey(room.topic)
        : null;

    /*
     * Preserve previous Cosmos behaviour:
     * when topic is specified, first perform an exact
     * case-insensitive topic match in the database.
     */
    if (normalizedTopic && room.topic) {
      mongoFilter.topic = {
        $regex: `^${String(room.topic)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        $options: 'i',
      };
    }

    let resources = await questions
      .find(mongoFilter)
      .toArray();

    /*
     * Keep your existing normalized cross-field validation.
     */
    if (normalizedTopic) {
      resources = resources.filter((question) =>
        matchesNormalizedTopic(
          question,
          normalizedTopic
        )
      );
    }

    if (resources.length === 0) {
      const filterLabel =
        room.topic &&
        room.topic !== 'all'
          ? `topic: ${room.topic}`
          : `subject: ${room.subject || 'all'}`;

      io.to(code).emit('room:error', {
        message:
          `No questions found for ${filterLabel}`,
      });

      return;
    }

    // Shuffle and select requested count
    const playableResources = resources.filter((question) =>
      Array.isArray(question.options)
      && question.options.length >= 2
      && getCorrectAnswerIndex(question) !== null
    );

    if (playableResources.length === 0) {
      io.to(code).emit('room:error', {
        message: 'No playable questions found for this battle. Try another topic.',
      });
      return;
    }

    const shuffled = playableResources
      .sort(() => Math.random() - 0.5)
      .slice(0, room.questionCount);

    const activeRoom = await setQuestions(code, shuffled);
    if (!activeRoom) return;

    io.to(code).emit('game:start', {
      message: 'Battle started!',
      total: shuffled.length,
      topic: activeRoom.topic,
    });

    setTimeout(() => {
      const first = shuffled[0];

      io.to(code).emit('game:question', {
        question: first.question,
        options: first.options,
        questionIndex: 0,
        total: shuffled.length,
        deadline: activeRoom.questionDeadline,
      });
    }, 1200);

  } catch (err) {
    console.error(
      'startGame error:',
      err.message
    );

    io.to(code).emit('room:error', {
      message:
        'Failed to load questions. Try again.',
    });
  }
}

// backend/battle/battleSocket.js
import { Server } from 'socket.io';
import {
  createRoom, joinRoom, getRoom, deleteRoom,
  setQuestions, getCurrentQuestion, submitAnswer,
  nextQuestion, getScores, getRoomBySocket,
} from './roomManager.js';
import { getQuestionsCollection, getUsersCollection } from '../config/mongodb.js';
import { sendPushToUser } from '../services/pushNotificationService.js';
import {
  verifyToken,
  signBattleRematchToken,
  verifyBattleRematchToken,
} from '../auth/jwt.js';
import { setNotificationRealtimeServer } from '../services/notificationRealtime.js';

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

const REVEAL_DELAY  = 2000; // ms to show results before next question
const ROOM_CREATE_COOLDOWN_MS = 10_000; // per-socket room creation throttle

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
  });

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

    // ── Create room ──────────────────────────────────────
    socket.on('room:create', async ({ playerName, subject = 'mathematics', topic = 'all', questionCount = 10 }) => {
      const now = Date.now();
      if (now - lastRoomCreateTime < ROOM_CREATE_COOLDOWN_MS) {
        socket.emit('room:error', { message: 'Please wait before creating another room.' });
        return;
      }
      lastRoomCreateTime = now;

      const code = createRoom(socket.id, playerName, subject, topic, questionCount, socket.user?.id);
      socket.join(code);
      socket.emit('room:created', { code, playerName });
      console.log(`Room ${code} created by ${playerName}`);
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

      const room = getRoom(normalizedCode);
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
          socket.user?.name || room.players?.[socket.id]?.name || 'A player'
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

        const code = createRoom(
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
      const result = joinRoom(normalizedCode, socket.id, playerName, socket.user?.id);

      if (result.error) {
        socket.emit('room:error', { message: result.error });
        return;
      }

      socket.join(normalizedCode);

      // Notify both players of updated player list
      io.to(normalizedCode).emit('room:joined', {
        players: Object.values(result.room.players).map(p => p.name),
      });

      // Both players present — start the game
      await startGame(io, normalizedCode);
    });

    // ── Submit answer ────────────────────────────────────
    socket.on('game:answer', ({ code, answer }) => {
      const result = submitAnswer(code, socket.id, answer);
      if (!result) return;

      // Tell THIS player their result immediately
      socket.emit('game:answerResult', { isCorrect: result.isCorrect });

      // Tell OPPONENT what this player answered
      const room = getRoom(code);
      const opponentSocketId = Object.keys(room?.players ?? {})
        .find(id => id !== socket.id);
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('game:opponentAnswer', { answer });
      }

      // Broadcast updated scores (includes answered flag)
      io.to(code).emit('game:scores', { scores: result.scores });

      // Move to next question only when BOTH answered
      if (result.allAnswered) {
        setTimeout(() => {
          const hasNext = nextQuestion(code);
          const updatedRoom = getRoom(code);
          if (!updatedRoom) return;

          if (hasNext) {
            const q = getCurrentQuestion(code);
            io.to(code).emit('game:question', {
              question:      q.question,
              options:       q.options,
              questionIndex: updatedRoom.currentIndex,
              total:         updatedRoom.questions.length,
            });
          } else {
            const finishedRoom = getRoom(code);
            const finalScores = getScores(code);

            const entries = Object.entries(finishedRoom?.players || {});

            for (const [socketId, player] of entries) {
              const opponent = entries.find(([id]) => id !== socketId)?.[1];

              let rematchToken = null;
              if (player?.userId && opponent?.userId) {
                rematchToken = signBattleRematchToken({
                  requesterUserId: player.userId,
                  opponentUserId: opponent.userId,
                  opponentName: opponent.name,
                  subject: finishedRoom.subject,
                  topic: finishedRoom.topic,
                  questionCount: finishedRoom.questionCount,
                });
              }

              io.to(socketId).emit('game:end', {
                scores: finalScores,
                rematchToken,
                opponentName: opponent?.name || 'Opponent',
              });
            }

            deleteRoom(code);

            // Do not block game completion on FCM.
            void sendBattleResultNotifications(
              finishedRoom,
              finalScores
            ).catch((error) => {
              console.error(
                'Battle result notification error:',
                error
              );
            });
          }
        }, REVEAL_DELAY);
      }
    });

    // ── Disconnect ───────────────────────────────────────
    socket.on('disconnect', () => {
      const found = getRoomBySocket(socket.id);
      if (found) {
        io.to(found.code).emit('room:playerLeft', {
          message: 'Opponent disconnected from the battle.',
        });
        deleteRoom(found.code);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

// ── Fetch questions and start game ───────────────────────
async function startGame(io, code) {
  const room = getRoom(code);
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
    const shuffled = resources
      .sort(() => Math.random() - 0.5)
      .slice(0, room.questionCount);

    setQuestions(code, shuffled);

    room.status = 'active';

    io.to(code).emit('game:start', {
      message: 'Battle started!',
      total: shuffled.length,
      topic: room.topic,
    });

    setTimeout(() => {
      const first = shuffled[0];

      io.to(code).emit('game:question', {
        question: first.question,
        options: first.options,
        questionIndex: 0,
        total: shuffled.length,
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

export async function sendBattleResultNotifications(
  room,
  scores
) {
  if (!room) {
    return;
  }

  const players =
    Object.entries(room.players);

  if (players.length !== 2) {
    return;
  }

  const scoredPlayers =
    players.map(
      ([socketId, player]) => ({
        socketId,
        player,

        score:
          scores[socketId]?.score ??
          player.score ??
          0,
      })
    );

  const maxScore =
    Math.max(
      ...scoredPlayers.map(
        (entry) => entry.score
      )
    );

  const winnerCount =
    scoredPlayers.filter(
      (entry) =>
        entry.score === maxScore
    ).length;

  const jobs =
    scoredPlayers.map(
      async (entry) => {
        const {
          socketId,
          player,
          score,
        } = entry;

        if (!player.userId) {
          return;
        }

        const opponent =
          scoredPlayers.find(
            (other) =>
              other.socketId !==
              socketId
          );

        if (!opponent) {
          return;
        }

        let title;
        let body;
        let result;

        if (winnerCount > 1) {
          title =
            "Battle Draw 🤝";

          body =
            `You and ${opponent.player.name} finished ${score}-${opponent.score}.`;

          result = "draw";

        } else if (
          score === maxScore
        ) {
          title =
            "You Won! 🏆";

          body =
            `You defeated ${opponent.player.name} ${score}-${opponent.score}.`;

          result = "win";

        } else {
          title =
            "Battle Finished ⚔️";

          body =
            `${opponent.player.name} won ${opponent.score}-${score}. Ready for a rematch?`;

          result = "loss";
        }

        return sendPushToUser(
          player.userId,
          {
            title,
            body,

            route:
              "/battle",

            category:
              "battleResults",

            data: {
              type:
                "battle_result",

              result,

              score,

              opponentScore:
                opponent.score,

              opponentName:
                opponent.player.name,

              subject:
                room.subject || "",

              topic:
                room.topic || "",
            },

            centerKey:
              room.code
                ? `battle-result:${room.code}:${player.userId}`
                : null,
          }
        );
      }
    );

  const results =
    await Promise.allSettled(
      jobs
    );

  results.forEach(
    (result) => {
      if (
        result.status ===
        "rejected"
      ) {
        console.error(
          "Battle result push failed:",
          result.reason
        );
      }
    }
  );
}

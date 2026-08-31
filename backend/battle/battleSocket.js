// backend/battle/battleSocket.js
import { Server } from 'socket.io';
import {
  createRoom, joinRoom, getRoom, deleteRoom,
  setQuestions, getCurrentQuestion, submitAnswer,
  nextQuestion, getScores, getRoomBySocket,
} from './roomManager.js';
import { getQuestionsCollection } from '../config/mongodb.js';
import { verifyToken } from '../auth/jwt.js';

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
    let lastRoomCreateTime = 0;

    // ── Create room ──────────────────────────────────────
    socket.on('room:create', async ({ playerName, subject = 'mathematics', topic = 'all', questionCount = 10 }) => {
      const now = Date.now();
      if (now - lastRoomCreateTime < ROOM_CREATE_COOLDOWN_MS) {
        socket.emit('room:error', { message: 'Please wait before creating another room.' });
        return;
      }
      lastRoomCreateTime = now;

      const code = createRoom(socket.id, playerName, subject, topic, questionCount);
      socket.join(code);
      socket.emit('room:created', { code, playerName });
      console.log(`Room ${code} created by ${playerName}`);
    });

    // ── Join room ────────────────────────────────────────
    socket.on('room:join', async ({ code, playerName }) => {
      const normalizedCode = String(code ?? '').replace(/\D/g, '').slice(0, 4);
      if (normalizedCode.length !== 4) {
        socket.emit('room:error', { message: 'Enter 4-digit room code' });
        return;
      }
      const result = joinRoom(normalizedCode, socket.id, playerName);

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
            io.to(code).emit('game:end', { scores: result.scores });
            deleteRoom(code);
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

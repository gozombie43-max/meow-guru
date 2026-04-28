// backend/battle/battleSocket.js
import { Server } from 'socket.io';
import {
  createRoom, joinRoom, getRoom, deleteRoom,
  setQuestions, getCurrentQuestion, submitAnswer,
  nextQuestion, getScores, getRoomBySocket,
} from './roomManager.js';
import { getQuestionsContainer } from '../containerStore.js';

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

export function initBattleSocket(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: [...allowedOrigins], credentials: true },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ── Create room ──────────────────────────────────────
    socket.on('room:create', async ({ playerName, subject = 'mathematics', topic = 'all', questionCount = 10 }) => {
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
    const container = getQuestionsContainer();
    const filters = [];
    const parameters = [];

    if (room.subject) {
      filters.push('LOWER(c.subject) = LOWER(@subject)');
      parameters.push({ name: '@subject', value: room.subject });
    }

    const normalizedTopic = room.topic && room.topic !== 'all' ? normalizeSearchKey(room.topic) : null;
    const whereClause = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';

    let { resources } = await container.items.query(
      { query: `SELECT * FROM c${whereClause}`, parameters },
      { enableCrossPartition: true, maxItemCount: 1000 }
    ).fetchAll({ enableCrossPartition: true, maxItemCount: 1000 });

    if (normalizedTopic) {
      resources = resources.filter((q) => matchesNormalizedTopic(q, normalizedTopic));
    }

    if (resources.length === 0) {
      const filterLabel = room.topic && room.topic !== 'all'
        ? `topic: ${room.topic}`
        : `subject: ${room.subject || 'all'}`;
      io.to(code).emit('room:error', { message: `No questions found for ${filterLabel}` });
      return;
    }

    // Shuffle and pick questionCount
    const shuffled = resources
      .sort(() => Math.random() - 0.5)
      .slice(0, room.questionCount);

    setQuestions(code, shuffled);
    room.status = 'active';

    // Notify game starting
    io.to(code).emit('game:start', {
      message: 'Battle started!',
      total:   shuffled.length,
      topic:   room.topic,
    });

    // Send first question after 1 second
    setTimeout(() => {
      const first = shuffled[0];
      io.to(code).emit('game:question', {
        question:      first.question,
        options:       first.options,
        questionIndex: 0,
        total:         shuffled.length,
      });
    }, 1200);

  } catch (err) {
    console.error('startGame error:', err.message);
    io.to(code).emit('room:error', { message: 'Failed to load questions. Try again.' });
  }
}
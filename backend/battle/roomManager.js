// backend/battle/roomManager.js

const rooms = new Map();

function generateCode(existing) {
  for (let i = 0; i < 20; i += 1) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    if (!existing.has(code)) return code;
  }
  return String(Date.now() % 10000).padStart(4, '0');
}

export function createRoom(socketId, playerName, subject, topic, questionCount) {
  const code = generateCode(rooms);
  rooms.set(code, {
    code,
    subject,
    topic,
    questionCount,
    questions:    [],
    currentIndex: 0,
    players: {
      [socketId]: { name: playerName, score: 0, answered: false },
    },
    status: 'waiting',   // waiting | active | finished
    createdAt: Date.now(),
  });
  return code;
}

export function joinRoom(code, socketId, playerName) {
  const room = rooms.get(code);
  if (!room)                          return { error: 'Room not found' };
  if (room.status !== 'waiting')      return { error: 'Game already started' };
  if (Object.keys(room.players).length >= 2) return { error: 'Room is full' };

  room.players[socketId] = { name: playerName, score: 0, answered: false };
  return { room };
}

export function getRoom(code)         { return rooms.get(code); }
export function deleteRoom(code)      { rooms.delete(code); }

export function setQuestions(code, questions) {
  const room = rooms.get(code);
  if (room) room.questions = questions;
}

export function getCurrentQuestion(code) {
  const room = rooms.get(code);
  if (!room) return null;
  return room.questions[room.currentIndex] || null;
}

export function submitAnswer(code, socketId, answer) {
  const room = rooms.get(code);
  if (!room) return null;

  const q = room.questions[room.currentIndex];
  const player = room.players[socketId];
  if (!player || player.answered) return null;

  player.answered = true;
  player.lastAnswer = answer;
  const isCorrect = answer === q.correctAnswer;
  if (isCorrect) player.score += 10;

  // Check if both players answered
  const allAnswered = Object.values(room.players).every(p => p.answered);
  return { isCorrect, allAnswered, scores: getScores(code) };
}

export function nextQuestion(code) {
  const room = rooms.get(code);
  if (!room) return false;

  // Reset answered flags
  Object.values(room.players).forEach(p => { p.answered = false; });
  room.currentIndex++;

  return room.currentIndex < room.questions.length;
}

export function getScores(code) {
  const room = rooms.get(code);
  if (!room) return {};
  return Object.fromEntries(
    Object.entries(room.players).map(([id, p]) => [
      id,
      {
        name: p.name,
        score: p.score,
        answered: p.answered,
        lastAnswer: p.lastAnswer ?? null,
      },
    ])
  );
}

export function getRoomBySocket(socketId) {
  for (const [code, room] of rooms.entries()) {
    if (room.players[socketId]) return { code, room };
  }
  return null;
}
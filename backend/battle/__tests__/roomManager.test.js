import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom,
  setQuestions,
  getCurrentQuestion,
  submitAnswer,
  nextQuestion,
  getScores,
  getRoomBySocket,
} from '../roomManager.js';

describe('Battle Room Manager', () => {
  let roomCode;
  const player1Socket = 'socket_p1';
  const player2Socket = 'socket_p2';

  beforeEach(() => {
    roomCode = createRoom(player1Socket, 'Player One', 'mathematics', 'percentages', 5);
  });

  afterEach(() => {
    if (roomCode) {
      deleteRoom(roomCode);
    }
  });

  it('creates room with 4-digit code and initial waiting state', () => {
    expect(roomCode).toMatch(/^\d{4}$/);
    const room = getRoom(roomCode);
    expect(room).toBeDefined();
    expect(room.subject).toBe('mathematics');
    expect(room.topic).toBe('percentages');
    expect(room.status).toBe('waiting');
    expect(room.players[player1Socket].name).toBe('Player One');
  });

  it('allows second player to join and rejects third player', () => {
    const joinResult = joinRoom(roomCode, player2Socket, 'Player Two');
    expect(joinResult.error).toBeUndefined();
    expect(joinResult.room.players[player2Socket].name).toBe('Player Two');

    const thirdJoin = joinRoom(roomCode, 'socket_p3', 'Player Three');
    expect(thirdJoin.error).toBe('Room is full');
  });

  it('handles question sets, answer submissions and score incrementing', () => {
    joinRoom(roomCode, player2Socket, 'Player Two');
    const mockQuestions = [
      { id: 101, question: 'What is 10% of 50?', correctAnswer: 1 },
      { id: 102, question: 'What is 20% of 100?', correctAnswer: 2 },
    ];
    setQuestions(roomCode, mockQuestions);

    const currentQ = getCurrentQuestion(roomCode);
    expect(currentQ.id).toBe(101);

    // Player 1 submits correct answer
    const p1Result = submitAnswer(roomCode, player1Socket, 1);
    expect(p1Result.isCorrect).toBe(true);
    expect(p1Result.allAnswered).toBe(false);

    // Player 2 submits wrong answer
    const p2Result = submitAnswer(roomCode, player2Socket, 3);
    expect(p2Result.isCorrect).toBe(false);
    expect(p2Result.allAnswered).toBe(true);

    const scores = getScores(roomCode);
    expect(scores[player1Socket].score).toBe(10);
    expect(scores[player2Socket].score).toBe(0);

    const hasNext = nextQuestion(roomCode);
    expect(hasNext).toBe(true);
    expect(getCurrentQuestion(roomCode).id).toBe(102);
  });

  it('finds room by socket ID and deletes room on cleanup', () => {
    const lookup = getRoomBySocket(player1Socket);
    expect(lookup).not.toBeNull();
    expect(lookup.code).toBe(roomCode);

    deleteRoom(roomCode);
    expect(getRoom(roomCode)).toBeUndefined();
  });
});

import { getScores, buildBattleReview } from './roomManager.js';
import { settleBattleResult } from './battleResultService.js';
import { signBattleRematchToken } from '../auth/jwt.js';
import { sendPushToUser } from '../services/pushNotificationService.js';
export async function finishBattle(io, finishedRoom) {
  const finalScores = await getScores(finishedRoom.code);
  const settlement = await settleBattleResult(finishedRoom).catch((error) => {
    console.error('Battle settlement failed:', error);
    return null;
  });
  const players = finishedRoom.players;
  for (const player of players) {
    const opponent = players.find((candidate) => candidate.userId !== player.userId);
    const rematchToken = player.userId && opponent?.userId
      ? signBattleRematchToken({ requesterUserId: player.userId, opponentUserId: opponent.userId, opponentName: opponent.name, subject: finishedRoom.subject, topic: finishedRoom.topic, questionCount: finishedRoom.questionCount })
      : null;
    if (io && player.socketId) {
      const matchPlayer = settlement?.match?.players?.find((entry) => entry.userId === player.userId);
      const stats = (entry) => { const answers = Array.isArray(entry?.answerLog) ? entry.answerLog : [], answered = answers.filter((answer) => !answer.timedOut), correct = answers.filter((answer) => answer.correct), times = answered.map((answer) => answer.responseTimeMs).filter(Number.isFinite); return { correct: correct.length, total: answers.length, accuracy: answers.length ? Math.round(correct.length / answers.length * 100) : 0, averageResponseMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null, timedOut: answers.filter((answer) => answer.timedOut).length }; };
      const opponentMatchPlayer = settlement?.match?.players?.find((entry) => entry.userId === opponent?.userId);
      const review = buildBattleReview(finishedRoom, player.userId);
      io.to(player.socketId).emit('game:end', {
        scores: finalScores,
        finishReason: finishedRoom.finishReason,
        winnerUserId: finishedRoom.winnerUserId || null,
        loserUserId: finishedRoom.loserUserId || null,
        rematchToken,
        opponentName: opponent?.name || 'Opponent',
        matchStats: { me: stats(matchPlayer), opponent: stats(opponentMatchPlayer) },
        rating: matchPlayer ? { lifetime: { before: matchPlayer.ratingBefore, after: matchPlayer.ratingAfter, delta: matchPlayer.ratingDelta }, season: matchPlayer.seasonRatingAfter !== null ? { before: matchPlayer.seasonRatingBefore, after: matchPlayer.seasonRatingAfter, delta: matchPlayer.seasonRatingDelta, tierBefore: matchPlayer.seasonTierBefore, tierAfter: matchPlayer.seasonTierAfter } : null } : null,
        review,
      });
    }
  }
  await sendBattleResultNotifications(finishedRoom, finalScores)
    .catch((error) => console.error('Battle result notification error:', error));
}

export async function sendBattleResultNotifications(
  room,
  scores
) {
  if (!room) {
    return;
  }

  const players = room.players || [];

  if (players.length !== 2) {
    return;
  }

  const scoredPlayers =
    players.map(
      (player) => ({
        player,
        score:
          scores[player.userId]?.score ??
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
          player,
          score,
        } = entry;

        if (!player.userId) {
          return;
        }

        const opponent =
          scoredPlayers.find(
            (other) =>
              other.player.userId !==
              player.userId
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

import { GAME_CONFIG, ROOM_STATUS } from '../config/constants.js';
import { getRandomWords } from '../data/words.js';

export function startGame(io, room) {
  room.clearTimers();

  // Reset scores and build deterministic turn order
  for (const player of room.players.values()) {
    player.score = 0;
    player.hasGuessed = false;
  }

  room.drawerOrder = Array.from(room.players.keys());
  room.drawerIndex = -1;
  room.roundNumber = 1;

  advanceTurn(io, room);
}

export function advanceTurn(io, room) {
  room.clearTimers();

  // Find next valid connected player in drawerOrder
  let nextDrawerId = null;
  while (room.drawerOrder.length > 0) {
    room.drawerIndex++;

    // Completed a full cycle of players -> advance to next round
    if (room.drawerIndex >= room.drawerOrder.length) {
      room.drawerIndex = 0;
      room.roundNumber++;

      if (room.roundNumber > GAME_CONFIG.TOTAL_ROUNDS) {
        return endGame(io, room);
      }
    }

    const candidateId = room.drawerOrder[room.drawerIndex];
    if (room.players.has(candidateId)) {
      nextDrawerId = candidateId;
      break;
    } else {
      room.drawerOrder.splice(room.drawerIndex, 1);
      room.drawerIndex--;
    }
  }

  if (!nextDrawerId || room.players.size < GAME_CONFIG.MIN_PLAYERS_TO_START) {
    return endGame(io, room);
  }

  // Enter WORD_SELECT phase
  room.status = ROOM_STATUS.WORD_SELECT;
  room.currentDrawerId = nextDrawerId;
  room.currentWord = null;
  room.revealedIndices.clear();
  room.resetPlayerGuesses();
  room.clearStrokes();
  room.wordChoices = getRandomWords(3);
  room.timeLeft = GAME_CONFIG.WORD_SELECT_DURATION_SEC;

  io.to(room.roomCode).emit('canvas_cleared');
  io.to(room.roomCode).emit('room_updated', room.toPublicState());

  // Send 3 word choices ONLY to the active drawer
  io.to(room.currentDrawerId).emit('word_choices', {
    words: room.wordChoices,
  });

  // Countdown for word selection; auto-pick first word if drawer stalls
  room.timerInterval = setInterval(() => {
    room.timeLeft--;
    io.to(room.roomCode).emit('timer_tick', { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      const fallbackWord = room.wordChoices[0];
      beginDrawingPhase(io, room, fallbackWord);
    }
  }, 1000);
}

export function beginDrawingPhase(io, room, chosenWord) {
  if (room.status !== ROOM_STATUS.WORD_SELECT) return;
  if (!room.wordChoices.includes(chosenWord)) return;

  room.clearTimers();
  room.status = ROOM_STATUS.DRAWING;
  room.currentWord = chosenWord;
  room.wordChoices = [];
  room.roundStartTime = Date.now();
  room.timeLeft = GAME_CONFIG.ROUND_DURATION_SEC;

  const halfTime = Math.floor(GAME_CONFIG.ROUND_DURATION_SEC * 0.5);
  const quarterTime = Math.floor(GAME_CONFIG.ROUND_DURATION_SEC * 0.25);

  io.to(room.roomCode).emit('room_updated', room.toPublicState());
  io.to(room.currentDrawerId).emit('secret_word', { word: room.currentWord });

  room.timerInterval = setInterval(() => {
    room.timeLeft--;
    io.to(room.roomCode).emit('timer_tick', { timeLeft: room.timeLeft });

    // Progressive letter hints at 50% and 25% remaining time
    if (room.timeLeft === halfTime || room.timeLeft === quarterTime) {
      room.revealRandomHint();
      io.to(room.roomCode).emit('hint_updated', {
        maskedWord: room.getMaskedWord(),
      });
    }

    if (room.timeLeft <= 0) {
      endRound(io, room, 'Time is up!');
    }
  }, 1000);
}

export function checkEarlyRoundEnd(io, room) {
  if (room.status === ROOM_STATUS.DRAWING && room.haveAllGuessersGuessed()) {
    endRound(io, room, 'Everyone guessed the word!');
  }
}

export function endRound(io, room, reason) {
  if (room.status === ROOM_STATUS.ROUND_END) return;

  room.clearTimers();
  room.status = ROOM_STATUS.ROUND_END;
  room.timeLeft = GAME_CONFIG.ROUND_END_DURATION_SEC;

  const revealedWord = room.currentWord;

  io.to(room.roomCode).emit('round_ended', {
    reason,
    word: revealedWord,
  });
  io.to(room.roomCode).emit('room_updated', room.toPublicState());

  room.timerInterval = setInterval(() => {
    room.timeLeft--;
    io.to(room.roomCode).emit('timer_tick', { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      advanceTurn(io, room);
    }
  }, 1000);
}

export function endGame(io, room) {
  room.clearTimers();
  room.status = ROOM_STATUS.GAME_OVER;
  room.currentDrawerId = null;
  room.currentWord = null;
  room.timeLeft = 0;

  const leaderboard = Array.from(room.players.values()).sort(
    (a, b) => b.score - a.score
  );

  io.to(room.roomCode).emit('game_over', { leaderboard });
  io.to(room.roomCode).emit('room_updated', room.toPublicState());
}
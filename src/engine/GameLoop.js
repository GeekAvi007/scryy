import { GAME_CONFIG, ROOM_STATUS } from '../config/constants.js';
import { getRandomWords } from '../data/words.js';
import { recordMatchStats } from '../db/postgres.js';

export function startGame(io, room) {
  room.clearTimers();

  for (const player of room.players.values()) {
    player.score = 0;
    player.wordsGuessed = 0;
    player.hasGuessed = false;
  }

  room.drawerOrder = Array.from(room.players.keys());
  room.drawerIndex = -1;
  room.roundNumber = 1;

  advanceTurn(io, room);
}

export function advanceTurn(io, room) {
  room.clearTimers();

  if (room.players.size < GAME_CONFIG.MIN_PLAYERS_TO_START) {
    return endGame(io, room, 'Not enough players to continue.');
  }

  let nextDrawerId = null;
  while (room.drawerOrder.length > 0) {
    room.drawerIndex++;

    if (room.drawerIndex >= room.drawerOrder.length) {
      room.drawerIndex = 0;
      room.roundNumber++;

      if (room.roundNumber > GAME_CONFIG.TOTAL_ROUNDS) {
        return endGame(io, room, 'All rounds completed!');
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

  if (!nextDrawerId) {
    return endGame(io, room, 'No available drawers.');
  }

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

  const drawerSocketId = room.getDrawerSocketId();
  if (drawerSocketId) {
    io.to(drawerSocketId).emit('word_choices', {
      words: room.wordChoices,
    });
  }

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

  const drawerSocketId = room.getDrawerSocketId();
  if (drawerSocketId) {
    io.to(drawerSocketId).emit('secret_word', { word: room.currentWord });
  }

  room.timerInterval = setInterval(() => {
    room.timeLeft--;
    io.to(room.roomCode).emit('timer_tick', { timeLeft: room.timeLeft });

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
  if (room.status === ROOM_STATUS.ROUND_END || room.status === ROOM_STATUS.GAME_OVER) {
    return;
  }

  room.clearTimers();
  room.status = ROOM_STATUS.ROUND_END;
  room.timeLeft = GAME_CONFIG.ROUND_END_DURATION_SEC;

  const revealedWord = room.currentWord || '(none)';

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

export function endGame(io, room, reason = 'Game finished!') {
  room.clearTimers();
  room.status = ROOM_STATUS.GAME_OVER;
  room.currentDrawerId = null;
  room.currentWord = null;
  room.timeLeft = 0;

  const playersArray = Array.from(room.players.values());
  const leaderboard = [...playersArray].sort((a, b) => b.score - a.score);

  // Persist career stats for authenticated players without blocking the socket loop
  recordMatchStats(playersArray);

  io.to(room.roomCode).emit('game_over', { reason, leaderboard });
  io.to(room.roomCode).emit('room_updated', room.toPublicState());
}

export function handlePlayerDisconnect(io, room, disconnectedPlayerId) {
  const isActiveGame =
    room.status === ROOM_STATUS.WORD_SELECT ||
    room.status === ROOM_STATUS.DRAWING ||
    room.status === ROOM_STATUS.ROUND_END;

  if (!isActiveGame) return;

  if (room.players.size < GAME_CONFIG.MIN_PLAYERS_TO_START) {
    return endGame(io, room, 'Game ended because fewer than 2 players remain.');
  }

  if (room.currentDrawerId === disconnectedPlayerId) {
    if (room.status === ROOM_STATUS.WORD_SELECT) {
      advanceTurn(io, room);
    } else if (room.status === ROOM_STATUS.DRAWING) {
      endRound(io, room, 'The drawer disconnected!');
    }
    return;
  }

  checkEarlyRoundEnd(io, room);
}
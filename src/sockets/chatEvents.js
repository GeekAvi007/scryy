import { roomManager } from '../state/RoomManager.js';
import { ROOM_STATUS, RATE_LIMITS } from '../config/constants.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import {
  calculateGuesserPoints,
  calculateDrawerPoints,
  isCloseGuess,
} from '../engine/ScoreCalculator.js';
import { checkEarlyRoundEnd } from '../engine/GameLoop.js';

export function registerChatEvents(io, socket) {
  socket.on('send_message', (payload) => {
    if (!rateLimiter.allow(socket.id, 'send_message', RATE_LIMITS.CHAT_MAX_PER_3_SEC, 3000)) {
      return socket.emit('system_notice', {
        text: 'You are sending messages too fast. Slow down!',
      });
    }

    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (!payload || typeof payload.message !== 'string') return;
    const cleanMsg = payload.message.trim().slice(0, 120);
    if (!cleanMsg) return;

    const isDrawingPhase = room.status === ROOM_STATUS.DRAWING;
    const isDrawer = room.currentDrawerId === socket.id;
    const secretWord = room.currentWord?.toLowerCase();

    if (isDrawingPhase && (isDrawer || player.hasGuessed) && secretWord) {
      if (cleanMsg.toLowerCase().includes(secretWord)) {
        return socket.emit('system_notice', {
          text: 'You cannot type the secret word in chat!',
        });
      }
    }

    if (isDrawingPhase && !isDrawer && !player.hasGuessed && secretWord) {
      if (cleanMsg.toLowerCase() === secretWord) {
        player.hasGuessed = true;

        const guesserPoints = calculateGuesserPoints(room.roundStartTime);
        player.score += guesserPoints;

        const drawer = room.players.get(room.currentDrawerId);
        if (drawer) {
          drawer.score += calculateDrawerPoints(room.players.size);
        }

        socket.emit('secret_word', { word: room.currentWord });

        io.to(room.roomCode).emit('correct_guess', {
          playerId: player.id,
          username: player.username,
          pointsEarned: guesserPoints,
        });

        io.to(room.roomCode).emit('room_updated', room.toPublicState());
        checkEarlyRoundEnd(io, room);
        return;
      }

      if (isCloseGuess(cleanMsg, secretWord)) {
        socket.emit('system_notice', {
          text: `'${cleanMsg}' is very close!`,
        });
        return;
      }
    }

    io.to(room.roomCode).emit('chat_message', {
      sender: player.username,
      text: cleanMsg,
      isGuessedPlayer: player.hasGuessed,
    });
  });
}
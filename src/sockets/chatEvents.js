import { roomManager } from '../state/RoomManager.js';
import { ROOM_STATUS } from '../config/constants.js';
import {
  calculateGuesserPoints,
  calculateDrawerPoints,
  isCloseGuess,
} from '../engine/ScoreCalculator.js';
import { checkEarlyRoundEnd } from '../engine/GameLoop.js';

export function registerChatEvents(io, socket) {
  socket.on('send_message', ({ message }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (typeof message !== 'string') return;
    const cleanMsg = message.trim().slice(0, 120);
    if (!cleanMsg) return;

    const isDrawingPhase = room.status === ROOM_STATUS.DRAWING;
    const isDrawer = room.currentDrawerId === socket.id;
    const secretWord = room.currentWord?.toLowerCase();

    // 1. Prevent drawer or already-guessed players from leaking the word during DRAWING
    if (isDrawingPhase && (isDrawer || player.hasGuessed) && secretWord) {
      if (cleanMsg.toLowerCase().includes(secretWord)) {
        return socket.emit('system_notice', {
          text: 'You cannot type the secret word in chat!',
        });
      }
    }

    // 2. Check guesses only during active DRAWING phase
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

        // End round early if every guesser has now solved the word
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

    // 3. Regular chat broadcast
    io.to(room.roomCode).emit('chat_message', {
      sender: player.username,
      text: cleanMsg,
      isGuessedPlayer: player.hasGuessed,
    });
  });
}
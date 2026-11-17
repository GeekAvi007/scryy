import { roomManager } from '../state/RoomManager.js';
import {
  calculateGuesserPoints,
  calculateDrawerPoints,
  isCloseGuess,
} from '../engine/ScoreCalculator.js';

export function registerChatEvents(io, socket) {
  socket.on('send_message', ({ message }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    if (typeof message !== 'string') return;
    const cleanMsg = message.trim().slice(0, 120);
    if (!cleanMsg) return;

    const isDrawer = room.currentDrawerId === socket.id;
    const secretWord = room.currentWord?.toLowerCase();

    // 1. Prevent drawer or already-guessed players from leaking the answer in chat
    if ((isDrawer || player.hasGuessed) && secretWord) {
      if (cleanMsg.toLowerCase().includes(secretWord)) {
        return socket.emit('system_notice', {
          text: 'You cannot type the secret word in chat!',
        });
      }
    }

    // 2. Check if an active guesser matched the secret word
    if (!isDrawer && !player.hasGuessed && secretWord) {
      if (cleanMsg.toLowerCase() === secretWord) {
        player.hasGuessed = true;

        const guesserPoints = calculateGuesserPoints(room.roundStartTime);
        player.score += guesserPoints;

        const drawer = room.players.get(room.currentDrawerId);
        if (drawer) {
          drawer.score += calculateDrawerPoints(room.players.size);
        }

        // Reveal the real word privately to the player who just guessed it
        socket.emit('secret_word', { word: room.currentWord });

        // Broadcast success without revealing the word to remaining guessers
        io.to(room.roomCode).emit('correct_guess', {
          playerId: player.id,
          username: player.username,
          pointsEarned: guesserPoints,
        });

        // Push updated scores & hasGuessed badges to everyone
        io.to(room.roomCode).emit('room_updated', room.toPublicState());
        return;
      }

      // 3. Check for a 1-letter typo ("close guess") and notify ONLY the guesser
      if (isCloseGuess(cleanMsg, secretWord)) {
        socket.emit('system_notice', {
          text: `'${cleanMsg}' is very close!`,
        });
        return;
      }
    }

    // 4. Regular chat message broadcast to the room
    io.to(room.roomCode).emit('chat_message', {
      sender: player.username,
      text: cleanMsg,
      isGuessedPlayer: player.hasGuessed,
    });
  });
}
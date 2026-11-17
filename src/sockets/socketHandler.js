import { registerRoomEvents } from './roomEvents.js';
import { registerDrawEvents } from './drawEvents.js';
import { registerChatEvents } from './chatEvents.js';
import { roomManager } from '../state/RoomManager.js';

export function registerSocketHandlers(io, socket) {
  console.log(`[CONNECTED] Socket ID: ${socket.id}`);

  registerRoomEvents(io, socket);
  registerDrawEvents(io, socket);
  registerChatEvents(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECTED] Socket ID: ${socket.id} | Reason: ${reason}`);

    const updatedRoom = roomManager.leaveRoom(socket.id);
    if (updatedRoom) {
      io.to(updatedRoom.roomCode).emit('room_updated', updatedRoom.toPublicState());

      // If host migrated to a new drawer in Milestone 4 testing, send them the word
      io.to(updatedRoom.currentDrawerId).emit('secret_word', {
        word: updatedRoom.currentWord,
      });
    }
  });
}
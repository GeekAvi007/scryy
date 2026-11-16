import { registerRoomEvents } from './roomEvents.js';
import { roomManager } from '../state/RoomManager.js';

export function registerSocketHandlers(io, socket) {
  console.log(`[CONNECTED] Socket ID: ${socket.id}`);

  // Register domain event modules
  registerRoomEvents(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECTED] Socket ID: ${socket.id} | Reason: ${reason}`);

    const updatedRoom = roomManager.leaveRoom(socket.id);
    if (updatedRoom) {
      // Broadcast updated player list & potentially new hostId to remaining players
      io.to(updatedRoom.roomCode).emit('room_updated', updatedRoom.toPublicState());
    }
  });
}
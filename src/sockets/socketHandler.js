import { registerRoomEvents } from './roomEvents.js';
import { registerDrawEvents } from './drawEvents.js';
import { registerChatEvents } from './chatEvents.js';
import { roomManager } from '../state/RoomManager.js';
import { handlePlayerDisconnect } from '../engine/GameLoop.js';
import { rateLimiter } from '../utils/rateLimiter.js';

export function registerSocketHandlers(io, socket) {
  console.log(`[CONNECTED] Socket ID: ${socket.id}`);

  registerRoomEvents(io, socket);
  registerDrawEvents(io, socket);
  registerChatEvents(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECTED] Socket ID: ${socket.id} | Reason: ${reason}`);

    // Clean up rate limiter memory for this socket
    rateLimiter.clearSocket(socket.id);

    const { room, removedPlayer } = roomManager.leaveRoom(socket.id);
    if (room && removedPlayer) {
      io.to(room.roomCode).emit('system_notice', {
        text: `${removedPlayer.username} left the room.`,
      });

      // Handle mid-turn drawer leave, solo-player abort, or early round completion
      handlePlayerDisconnect(io, room, socket.id);

      io.to(room.roomCode).emit('room_updated', room.toPublicState());
    }
  });
}
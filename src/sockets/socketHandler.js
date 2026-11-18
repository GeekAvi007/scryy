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
    rateLimiter.clearSocket(socket.id);

    const disconnected = roomManager.markPlayerDisconnected(
      socket.id,
      (room, removedPlayer) => {
        // Callback runs only if player fails to reconnect within 15 seconds
        io.to(room.roomCode).emit('system_notice', {
          text: `${removedPlayer.username} left the room.`,
        });

        handlePlayerDisconnect(io, room, removedPlayer.id);
        io.to(room.roomCode).emit('room_updated', room.toPublicState());
      }
    );

    if (disconnected) {
      const { room, player } = disconnected;
      io.to(room.roomCode).emit('room_updated', room.toPublicState());
      io.to(room.roomCode).emit('system_notice', {
        text: `${player.username} disconnected. Waiting 15s to reconnect...`,
      });
    }
  });
}
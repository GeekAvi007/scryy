import { roomManager } from '../state/RoomManager.js';

export function registerRoomEvents(io, socket) {
  socket.on('create_room', ({ username }) => {
    try {
      // Prevent one socket from joining multiple rooms simultaneously
      if (roomManager.getRoomBySocketId(socket.id)) {
        return socket.emit('room_error', { message: 'You are already in a room.' });
      }

      const room = roomManager.createRoom(socket.id, username);
      socket.join(room.roomCode);

      console.log(`[ROOM CREATED] ${room.roomCode} by ${username} (${socket.id})`);
      socket.emit('room_joined', room.toPublicState());
    } catch (err) {
      socket.emit('room_error', { message: err.message });
    }
  });

  socket.on('join_room', ({ roomCode, username }) => {
    try {
      if (roomManager.getRoomBySocketId(socket.id)) {
        return socket.emit('room_error', { message: 'You are already in a room.' });
      }

      const room = roomManager.joinRoom(roomCode, socket.id, username);
      socket.join(room.roomCode);

      console.log(`[PLAYER JOINED] ${username} (${socket.id}) -> ${room.roomCode}`);

      // Send full room state to the joining player
      socket.emit('room_joined', room.toPublicState());

      // Notify everyone in the room (including host) of the updated player list
      io.to(room.roomCode).emit('room_updated', room.toPublicState());
    } catch (err) {
      socket.emit('room_error', { message: err.message });
    }
  });
}
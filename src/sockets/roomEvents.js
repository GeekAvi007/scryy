import { roomManager } from '../state/RoomManager.js';

export function registerRoomEvents(io, socket) {
  socket.on('create_room', ({ username }) => {
    try {
      if (roomManager.getRoomBySocketId(socket.id)) {
        return socket.emit('room_error', { message: 'You are already in a room.' });
      }

      const room = roomManager.createRoom(socket.id, username);
      socket.join(room.roomCode);

      console.log(`[ROOM CREATED] ${room.roomCode} | Secret word: ${room.currentWord}`);
      socket.emit('room_joined', room.toPublicState());

      // Send the real secret word ONLY to the drawer
      socket.emit('secret_word', { word: room.currentWord });
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

      socket.emit('room_joined', room.toPublicState());

      if (room.strokeHistory.length > 0) {
        socket.emit('canvas_sync', room.strokeHistory);
      }

      io.to(room.roomCode).emit('room_updated', room.toPublicState());
    } catch (err) {
      socket.emit('room_error', { message: err.message });
    }
  });
}
import { roomManager } from '../state/RoomManager.js';
import { GAME_CONFIG, ROOM_STATUS } from '../config/constants.js';
import { startGame, beginDrawingPhase } from '../engine/GameLoop.js';

export function registerRoomEvents(io, socket) {
  socket.on('create_room', ({ username }) => {
    try {
      if (roomManager.getRoomBySocketId(socket.id)) {
        return socket.emit('room_error', { message: 'You are already in a room.' });
      }

      const room = roomManager.createRoom(socket.id, username);
      socket.join(room.roomCode);

      console.log(`[ROOM CREATED] ${room.roomCode} by ${username}`);
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

      console.log(`[PLAYER JOINED] ${username} -> ${room.roomCode}`);
      socket.emit('room_joined', room.toPublicState());

      if (room.strokeHistory.length > 0) {
        socket.emit('canvas_sync', room.strokeHistory);
      }

      io.to(room.roomCode).emit('room_updated', room.toPublicState());
    } catch (err) {
      socket.emit('room_error', { message: err.message });
    }
  });

  socket.on('start_game', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    if (room.hostId !== socket.id) {
      return socket.emit('room_error', { message: 'Only the host can start the game.' });
    }

    if (room.status !== ROOM_STATUS.LOBBY && room.status !== ROOM_STATUS.GAME_OVER) {
      return;
    }

    if (room.players.size < GAME_CONFIG.MIN_PLAYERS_TO_START) {
      return socket.emit('room_error', {
        message: `Need at least ${GAME_CONFIG.MIN_PLAYERS_TO_START} players to start.`,
      });
    }

    startGame(io, room);
  });

  socket.on('select_word', ({ word }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    if (room.currentDrawerId !== socket.id) return;
    if (room.status !== ROOM_STATUS.WORD_SELECT) return;

    beginDrawingPhase(io, room, word);
  });
}
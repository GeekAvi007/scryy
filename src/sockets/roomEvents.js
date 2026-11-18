import { roomManager } from '../state/RoomManager.js';
import { GAME_CONFIG, ROOM_STATUS, RATE_LIMITS } from '../config/constants.js';
import { startGame, beginDrawingPhase } from '../engine/GameLoop.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { verifyAuthToken } from '../routes/authRoutes.js';

export function registerRoomEvents(io, socket) {
  socket.on('create_room', (payload) => {
    if (!rateLimiter.allow(socket.id, 'room_action', RATE_LIMITS.ROOM_ACTION_MAX_PER_5_SEC, 5000)) {
      return socket.emit('room_error', { message: 'Too many requests. Please wait a moment.' });
    }

    try {
      if (roomManager.getRoomBySocketId(socket.id)) {
        return socket.emit('room_error', { message: 'You are already in a room.' });
      }

      const authUser = verifyAuthToken(payload?.authToken);
      const effectiveUsername = authUser ? authUser.username : payload?.username;
      const effectiveUserId = authUser ? authUser.userId : null;

      const { room, player } = roomManager.createRoom(
        socket.id,
        effectiveUsername,
        effectiveUserId
      );
      socket.join(room.roomCode);

      console.log(`[ROOM CREATED] ${room.roomCode} by ${player.username} (auth: ${!!authUser})`);
      socket.emit('session_credentials', {
        roomCode: room.roomCode,
        playerId: player.id,
        playerToken: player.playerToken,
      });
      socket.emit('room_joined', room.toPublicState());
    } catch (err) {
      socket.emit('room_error', { message: err.message });
    }
  });

  socket.on('join_room', (payload) => {
    if (!rateLimiter.allow(socket.id, 'room_action', RATE_LIMITS.ROOM_ACTION_MAX_PER_5_SEC, 5000)) {
      return socket.emit('room_error', { message: 'Too many requests. Please wait a moment.' });
    }

    try {
      if (roomManager.getRoomBySocketId(socket.id)) {
        return socket.emit('room_error', { message: 'You are already in a room.' });
      }

      const authUser = verifyAuthToken(payload?.authToken);
      const effectiveUsername = authUser ? authUser.username : payload?.username;
      const effectiveUserId = authUser ? authUser.userId : null;

      const { room, player } = roomManager.joinRoom(
        payload?.roomCode,
        socket.id,
        effectiveUsername,
        effectiveUserId
      );
      socket.join(room.roomCode);

      console.log(`[PLAYER JOINED] ${player.username} -> ${room.roomCode} (auth: ${!!authUser})`);
      socket.emit('session_credentials', {
        roomCode: room.roomCode,
        playerId: player.id,
        playerToken: player.playerToken,
      });
      socket.emit('room_joined', room.toPublicState());

      if (room.strokeHistory.length > 0) {
        socket.emit('canvas_sync', room.strokeHistory);
      }

      io.to(room.roomCode).emit('room_updated', room.toPublicState());
      io.to(room.roomCode).emit('system_notice', {
        text: `${player.username} joined the room.`,
      });
    } catch (err) {
      socket.emit('room_error', { message: err.message });
    }
  });

  socket.on('reconnect_player', (payload) => {
    const result = roomManager.reconnectPlayer(
      payload?.roomCode,
      payload?.playerToken,
      socket.id
    );

    if (!result) {
      return socket.emit('reconnect_failed');
    }

    const { room, player } = result;
    socket.join(room.roomCode);

    console.log(`[PLAYER RECONNECTED] ${player.username} -> ${room.roomCode}`);

    socket.emit('session_credentials', {
      roomCode: room.roomCode,
      playerId: player.id,
      playerToken: player.playerToken,
    });
    socket.emit('room_joined', room.toPublicState());

    if (room.strokeHistory.length > 0) {
      socket.emit('canvas_sync', room.strokeHistory);
    }

    const isDrawer = room.currentDrawerId === player.id;
    if (room.status === ROOM_STATUS.WORD_SELECT && isDrawer) {
      socket.emit('word_choices', { words: room.wordChoices });
    } else if (
      room.status === ROOM_STATUS.DRAWING &&
      (isDrawer || player.hasGuessed) &&
      room.currentWord
    ) {
      socket.emit('secret_word', { word: room.currentWord });
    }

    io.to(room.roomCode).emit('room_updated', room.toPublicState());
    io.to(room.roomCode).emit('system_notice', {
      text: `${player.username} reconnected!`,
    });
  });

  socket.on('start_game', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.getPlayerBySocketId(socket.id);
    if (!player || room.hostId !== player.id) {
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

  socket.on('select_word', (payload) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    const player = room.getPlayerBySocketId(socket.id);
    if (!player || room.currentDrawerId !== player.id) return;
    if (room.status !== ROOM_STATUS.WORD_SELECT) return;

    beginDrawingPhase(io, room, payload?.word);
  });
}
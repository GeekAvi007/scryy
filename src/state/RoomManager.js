import { Room } from './Room.js';
import { GAME_CONFIG } from '../config/constants.js';
import { generateUniqueRoomCode } from '../utils/roomCodeGenerator.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
    // Map<socketId, roomCode>
    this.socketToRoom = new Map();
  }

  createRoom(hostSocketId, hostUsername) {
    const roomCode = generateUniqueRoomCode(this.rooms);
    const room = new Room(roomCode, hostSocketId, hostUsername);
    const hostPlayer = room.getPlayerBySocketId(hostSocketId);

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(hostSocketId, roomCode);
    return { room, player: hostPlayer };
  }

  joinRoom(roomCode, socketId, username) {
    if (typeof roomCode !== 'string') {
      throw new Error('Invalid room code.');
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      throw new Error('Room not found. Check the room code.');
    }

    const player = room.addPlayer(socketId, username);
    this.socketToRoom.set(socketId, normalizedCode);
    return { room, player };
  }

  reconnectPlayer(roomCode, playerToken, newSocketId) {
    if (typeof roomCode !== 'string' || typeof playerToken !== 'string') {
      return null;
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);
    if (!room) return null;

    const player = room.getPlayerByToken(playerToken);
    if (!player) return null;

    // Cancel pending 15s eviction timer
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }

    // Clean up stale socket lookup if any
    if (player.socketId) {
      this.socketToRoom.delete(player.socketId);
    }

    player.socketId = newSocketId;
    player.connected = true;
    this.socketToRoom.set(newSocketId, normalizedCode);

    return { room, player };
  }

  getRoomByCode(roomCode) {
    return this.rooms.get(roomCode?.trim().toUpperCase());
  }

  getRoomBySocketId(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode) || null;
  }

  markPlayerDisconnected(socketId, onGraceExpired) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.getPlayerBySocketId(socketId);
    if (!player) return null;

    player.connected = false;

    player.disconnectTimer = setTimeout(() => {
      const currentRoom = this.rooms.get(roomCode);
      if (!currentRoom) return;

      const removedPlayer = currentRoom.removePlayer(player.id);

      if (currentRoom.isEmpty()) {
        currentRoom.clearTimers();
        this.rooms.delete(roomCode);
        console.log(`[ROOM DELETED] ${roomCode} (all players timed out)`);
        return;
      }

      if (removedPlayer && typeof onGraceExpired === 'function') {
        onGraceExpired(currentRoom, removedPlayer);
      }
    }, GAME_CONFIG.RECONNECT_GRACE_MS);

    return { room, player };
  }
}

export const roomManager = new RoomManager();
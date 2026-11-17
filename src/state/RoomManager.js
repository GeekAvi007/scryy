import { Room } from './Room.js';
import { generateUniqueRoomCode } from '../utils/roomCodeGenerator.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  createRoom(hostSocketId, hostUsername) {
    const roomCode = generateUniqueRoomCode(this.rooms);
    const room = new Room(roomCode, hostSocketId, hostUsername);

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(hostSocketId, roomCode);
    return room;
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

    room.addPlayer(socketId, username);
    this.socketToRoom.set(socketId, normalizedCode);
    return room;
  }

  getRoomByCode(roomCode) {
    return this.rooms.get(roomCode?.trim().toUpperCase());
  }

  getRoomBySocketId(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode) || null;
  }

  leaveRoom(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return { room: null, removedPlayer: null };

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return { room: null, removedPlayer: null };

    const removedPlayer = room.removePlayer(socketId);

    if (room.isEmpty()) {
      room.clearTimers();
      this.rooms.delete(roomCode);
      console.log(`[ROOM DELETED] ${roomCode} (empty)`);
      return { room: null, removedPlayer };
    }

    return { room, removedPlayer };
  }
}

export const roomManager = new RoomManager();
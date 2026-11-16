import { Room } from './Room.js';
import { generateUniqueRoomCode } from '../utils/roomCodeGenerator.js';

class RoomManager {
  constructor() {
    // Map<roomCode, Room>
    this.rooms = new Map();
    // Reverse lookup: Map<socketId, roomCode> for instant O(1) disconnect handling
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
    if (!roomCode) return null;

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.removePlayer(socketId);

    // Garbage collection: destroy empty rooms to prevent memory leaks
    if (room.isEmpty()) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      this.rooms.delete(roomCode);
      console.log(`[ROOM DELETED] ${roomCode} (empty)`);
      return null;
    }

    return room;
  }
}

export const roomManager = new RoomManager();
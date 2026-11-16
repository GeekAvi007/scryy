import { GAME_CONFIG, ROOM_STATUS } from '../config/constants.js';

export class Room {
  constructor(roomCode, hostSocketId, hostUsername) {
    this.roomCode = roomCode;
    this.hostId = hostSocketId;
    this.status = ROOM_STATUS.LOBBY;

    // Map<socketId, { id, username, score, hasGuessed }>
    this.players = new Map();
    this.addPlayer(hostSocketId, hostUsername);

    // Game state placeholders (used in Milestones 3–5)
    this.currentDrawerId = null;
    this.currentWord = null;
    this.roundNumber = 0;
    this.strokeHistory = [];
    this.timerInterval = null;
  }

  addPlayer(socketId, username) {
    if (this.players.size >= GAME_CONFIG.MAX_PLAYERS) {
      throw new Error('Room is full.');
    }

    const cleanName = username.trim();
    if (!cleanName || cleanName.length > 16) {
      throw new Error('Username must be between 1 and 16 characters.');
    }

    // Prevent duplicate names in the same room (case-insensitive)
    for (const player of this.players.values()) {
      if (player.username.toLowerCase() === cleanName.toLowerCase()) {
        throw new Error(`Username "${cleanName}" is already taken in this room.`);
      }
    }

    const player = {
      id: socketId,
      username: cleanName,
      score: 0,
      hasGuessed: false,
    };

    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    const removed = this.players.delete(socketId);
    if (!removed) return;

    // Host Migration: If the host left and players remain, promote the oldest player
    if (this.hostId === socketId && this.players.size > 0) {
      const nextHostId = this.players.keys().next().value;
      this.hostId = nextHostId;
    }
  }

  isEmpty() {
    return this.players.size === 0;
  }

  // Serializes safe room data to send to clients (NEVER expose currentWord here!)
  toPublicState() {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      status: this.status,
      currentDrawerId: this.currentDrawerId,
      roundNumber: this.roundNumber,
      players: Array.from(this.players.values()),
    };
  }
}
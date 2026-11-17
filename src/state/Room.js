import { GAME_CONFIG, ROOM_STATUS } from '../config/constants.js';
import { getRandomWord } from '../data/words.js';

export class Room {
  constructor(roomCode, hostSocketId, hostUsername) {
    this.roomCode = roomCode;
    this.hostId = hostSocketId;
    this.status = ROOM_STATUS.DRAWING;

    // Map<socketId, { id, username, score, hasGuessed }>
    this.players = new Map();
    this.addPlayer(hostSocketId, hostUsername);

    // Temporarily assign host as drawer & pick a word to test Milestone 4
    this.currentDrawerId = hostSocketId;
    this.currentWord = getRandomWord();
    this.roundStartTime = Date.now();
    this.roundNumber = 1;
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

    if (this.hostId === socketId && this.players.size > 0) {
      const nextHostId = this.players.keys().next().value;
      this.hostId = nextHostId;
      if (this.currentDrawerId === socketId) {
        this.currentDrawerId = nextHostId;
      }
    }
  }

  addStroke(stroke) {
    this.strokeHistory.push(stroke);
  }

  clearStrokes() {
    this.strokeHistory = [];
  }

  isEmpty() {
    return this.players.size === 0;
  }

  getMaskedWord() {
    if (!this.currentWord) return '';
    return this.currentWord
      .split('')
      .map((char) => (char === ' ' ? '  ' : '_'))
      .join(' ');
  }

  // Serializes safe room data to send to clients (NEVER expose currentWord here!)
  toPublicState() {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      status: this.status,
      currentDrawerId: this.currentDrawerId,
      maskedWord: this.getMaskedWord(),
      roundNumber: this.roundNumber,
      players: Array.from(this.players.values()),
    };
  }
}
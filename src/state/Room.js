import { GAME_CONFIG, ROOM_STATUS } from '../config/constants.js';

export class Room {
  constructor(roomCode, hostSocketId, hostUsername) {
    this.roomCode = roomCode;
    this.hostId = hostSocketId;
    this.status = ROOM_STATUS.LOBBY;

    // Map<socketId, { id, username, score, hasGuessed }>
    this.players = new Map();
    this.addPlayer(hostSocketId, hostUsername);

    // Turn & round state
    this.currentDrawerId = null;
    this.currentWord = null;
    this.wordChoices = [];
    this.revealedIndices = new Set();
    this.roundNumber = 0;
    this.roundStartTime = null;
    this.timeLeft = 0;

    // Ordered list of player socket IDs for turn rotation
    this.drawerOrder = [];
    this.drawerIndex = -1;

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

    // If game is already running, add late joiner to end of rotation
    if (this.status !== ROOM_STATUS.LOBBY && !this.drawerOrder.includes(socketId)) {
      this.drawerOrder.push(socketId);
    }

    return player;
  }

  removePlayer(socketId) {
    const removed = this.players.delete(socketId);
    if (!removed) return;

    this.drawerOrder = this.drawerOrder.filter((id) => id !== socketId);

    if (this.hostId === socketId && this.players.size > 0) {
      this.hostId = this.players.keys().next().value;
    }
  }

  resetPlayerGuesses() {
    for (const player of this.players.values()) {
      player.hasGuessed = false;
    }
  }

  haveAllGuessersGuessed() {
    let guesserCount = 0;
    for (const player of this.players.values()) {
      if (player.id === this.currentDrawerId) continue;
      guesserCount++;
      if (!player.hasGuessed) return false;
    }
    return guesserCount > 0;
  }

  revealRandomHint() {
    if (!this.currentWord) return;
    const unrevealed = [];

    for (let i = 0; i < this.currentWord.length; i++) {
      if (this.currentWord[i] !== ' ' && !this.revealedIndices.has(i)) {
        unrevealed.push(i);
      }
    }

    // Never reveal the very last hidden letter
    if (unrevealed.length <= 1) return;

    const randomIdx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    this.revealedIndices.add(randomIdx);
  }

  getMaskedWord() {
    if (!this.currentWord) return '';
    return this.currentWord
      .split('')
      .map((char, idx) => {
        if (char === ' ') return '  ';
        return this.revealedIndices.has(idx) ? char.toUpperCase() : '_';
      })
      .join(' ');
  }

  addStroke(stroke) {
    this.strokeHistory.push(stroke);
  }

  clearStrokes() {
    this.strokeHistory = [];
  }

  clearTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  isEmpty() {
    return this.players.size === 0;
  }

  toPublicState() {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      status: this.status,
      currentDrawerId: this.currentDrawerId,
      maskedWord: this.getMaskedWord(),
      roundNumber: this.roundNumber,
      totalRounds: GAME_CONFIG.TOTAL_ROUNDS,
      timeLeft: this.timeLeft,
      players: Array.from(this.players.values()),
    };
  }
}
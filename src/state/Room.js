import crypto from 'crypto';
import { GAME_CONFIG, ROOM_STATUS } from '../config/constants.js';

export class Room {
  constructor(roomCode, hostSocketId, hostUsername) {
    this.roomCode = roomCode;
    this.status = ROOM_STATUS.LOBBY;

    // Map<playerId, { id, socketId, playerToken, username, score, hasGuessed, connected, disconnectTimer }>
    this.players = new Map();

    const hostPlayer = this.addPlayer(hostSocketId, hostUsername);
    this.hostId = hostPlayer.id;

    this.currentDrawerId = null;
    this.currentWord = null;
    this.wordChoices = [];
    this.revealedIndices = new Set();
    this.roundNumber = 0;
    this.roundStartTime = null;
    this.timeLeft = 0;

    // Ordered list of stable playerIds
    this.drawerOrder = [];
    this.drawerIndex = -1;

    this.strokeHistory = [];
    this.timerInterval = null;
  }

  addPlayer(socketId, username) {
    if (this.players.size >= GAME_CONFIG.MAX_PLAYERS) {
      throw new Error('Room is full.');
    }

    if (typeof username !== 'string') {
      throw new Error('Invalid username.');
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

    const playerId = crypto.randomUUID();
    const playerToken = crypto.randomUUID();

    const player = {
      id: playerId,
      socketId,
      playerToken,
      username: cleanName,
      score: 0,
      hasGuessed: false,
      connected: true,
      disconnectTimer: null,
    };

    this.players.set(playerId, player);

    if (this.status !== ROOM_STATUS.LOBBY && !this.drawerOrder.includes(playerId)) {
      this.drawerOrder.push(playerId);
    }

    return player;
  }

  getPlayerBySocketId(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) return player;
    }
    return null;
  }

  getPlayerByToken(playerToken) {
    if (!playerToken) return null;
    for (const player of this.players.values()) {
      if (player.playerToken === playerToken) return player;
    }
    return null;
  }

  getDrawerSocketId() {
    if (!this.currentDrawerId) return null;
    return this.players.get(this.currentDrawerId)?.socketId || null;
  }

  removePlayer(playerId) {
    const removedPlayer = this.players.get(playerId);
    if (!removedPlayer) return null;

    if (removedPlayer.disconnectTimer) {
      clearTimeout(removedPlayer.disconnectTimer);
      removedPlayer.disconnectTimer = null;
    }

    this.players.delete(playerId);

    const removedOrderIdx = this.drawerOrder.indexOf(playerId);
    if (removedOrderIdx !== -1) {
      this.drawerOrder.splice(removedOrderIdx, 1);
      if (removedOrderIdx <= this.drawerIndex) {
        this.drawerIndex = Math.max(-1, this.drawerIndex - 1);
      }
    }

    // Host migration: prefer a currently connected player first
    if (this.hostId === playerId && this.players.size > 0) {
      const connectedPlayer = Array.from(this.players.values()).find((p) => p.connected);
      this.hostId = connectedPlayer
        ? connectedPlayer.id
        : this.players.keys().next().value;
    }

    return removedPlayer;
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
    if (this.strokeHistory.length >= GAME_CONFIG.MAX_STROKES_PER_ROUND) {
      return false;
    }
    this.strokeHistory.push(stroke);
    return true;
  }

  clearStrokes() {
    this.strokeHistory = [];
  }

  clearTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    for (const player of this.players.values()) {
      if (player.disconnectTimer) {
        clearTimeout(player.disconnectTimer);
        player.disconnectTimer = null;
      }
    }
  }

  isEmpty() {
    return this.players.size === 0;
  }

  // Never expose playerToken or currentWord in public room state!
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
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        username: p.username,
        score: p.score,
        hasGuessed: p.hasGuessed,
        connected: p.connected,
      })),
    };
  }
}
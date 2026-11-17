class SocketRateLimiter {
    constructor() {
      this.history = new Map();
    }
  
    allow(socketId, eventName, maxEvents, windowMs) {
      const now = Date.now();
  
      if (!this.history.has(socketId)) {
        this.history.set(socketId, new Map());
      }
  
      const socketEvents = this.history.get(socketId);
      const timestamps = socketEvents.get(eventName) || [];
  

      const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);
  
      if (validTimestamps.length >= maxEvents) {
        socketEvents.set(eventName, validTimestamps);
        return false;
      }
  
      validTimestamps.push(now);
      socketEvents.set(eventName, validTimestamps);
      return true;
    }
  
    clearSocket(socketId) {
      this.history.delete(socketId);
    }
  }
  
  export const rateLimiter = new SocketRateLimiter();
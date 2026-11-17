import { roomManager } from '../state/RoomManager.js';
import { ROOM_STATUS, RATE_LIMITS } from '../config/constants.js';
import { rateLimiter } from '../utils/rateLimiter.js';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function registerDrawEvents(io, socket) {
  socket.on('draw_stroke', (stroke) => {
    if (!rateLimiter.allow(socket.id, 'draw_stroke', RATE_LIMITS.DRAW_MAX_PER_SEC, 1000)) {
      return;
    }

    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    if (room.status !== ROOM_STATUS.DRAWING) return;
    if (room.currentDrawerId !== socket.id) return;

    if (
      !stroke ||
      typeof stroke.x0 !== 'number' ||
      typeof stroke.y0 !== 'number' ||
      typeof stroke.x1 !== 'number' ||
      typeof stroke.y1 !== 'number' ||
      Number.isNaN(stroke.x0) ||
      Number.isNaN(stroke.y0) ||
      Number.isNaN(stroke.x1) ||
      Number.isNaN(stroke.y1)
    ) {
      return;
    }

    const cleanStroke = {
      x0: Math.max(0, Math.min(1, stroke.x0)),
      y0: Math.max(0, Math.min(1, stroke.y0)),
      x1: Math.max(0, Math.min(1, stroke.x1)),
      y1: Math.max(0, Math.min(1, stroke.y1)),
      color: HEX_COLOR_REGEX.test(stroke.color) ? stroke.color : '#000000',
      size: typeof stroke.size === 'number' ? Math.max(1, Math.min(30, stroke.size)) : 4,
    };

    const accepted = room.addStroke(cleanStroke);
    if (!accepted) return;

    socket.to(room.roomCode).emit('draw_stroke', cleanStroke);
  });

  socket.on('clear_canvas', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room || room.status !== ROOM_STATUS.DRAWING) return;
    if (room.currentDrawerId !== socket.id) return;

    room.clearStrokes();
    io.to(room.roomCode).emit('canvas_cleared');
  });
}
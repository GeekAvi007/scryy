import { roomManager } from '../state/RoomManager.js';
import { ROOM_STATUS } from '../config/constants.js';

export function registerDrawEvents(io, socket) {
  socket.on('draw_stroke', (stroke) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    // Only allow drawing during active DRAWING phase by the active drawer
    if (room.status !== ROOM_STATUS.DRAWING) return;
    if (room.currentDrawerId !== socket.id) return;

    if (
      !stroke ||
      typeof stroke.x0 !== 'number' ||
      typeof stroke.y0 !== 'number' ||
      typeof stroke.x1 !== 'number' ||
      typeof stroke.y1 !== 'number'
    ) {
      return;
    }

    const cleanStroke = {
      x0: Math.max(0, Math.min(1, stroke.x0)),
      y0: Math.max(0, Math.min(1, stroke.y0)),
      x1: Math.max(0, Math.min(1, stroke.x1)),
      y1: Math.max(0, Math.min(1, stroke.y1)),
      color: typeof stroke.color === 'string' ? stroke.color : '#000000',
      size: typeof stroke.size === 'number' ? Math.max(1, Math.min(30, stroke.size)) : 4,
    };

    room.addStroke(cleanStroke);
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
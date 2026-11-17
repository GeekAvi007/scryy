import { roomManager } from '../state/RoomManager.js';

export function registerDrawEvents(io, socket) {
  socket.on('draw_stroke', (stroke) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;

    // Server-Authoritative Check: Only the designated drawer may draw
    if (room.currentDrawerId !== socket.id) return;

    // Basic payload validation to ensure normalized coordinates (0.0 to 1.0)
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

    // Broadcast to everyone in the room EXCEPT the sender
    socket.to(room.roomCode).emit('draw_stroke', cleanStroke);
  });

  socket.on('clear_canvas', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room || room.currentDrawerId !== socket.id) return;

    room.clearStrokes();
    io.to(room.roomCode).emit('canvas_cleared');
  });
}
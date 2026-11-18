import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { registerSocketHandlers } from './sockets/socketHandler.js';
import { attachRedisAdapter } from './config/redisAdapter.js';
import { roomManager } from './state/RoomManager.js';
import { initDb, isDbAvailable } from './db/postgres.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', authRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    pid: process.pid,
    postgresConnected: isDbAvailable(),
    activeRooms: roomManager.rooms.size,
    connectedSockets: io.engine.clientsCount,
    uptimeSec: Math.floor(process.uptime()),
  });
});

await initDb();
await attachRedisAdapter(io);

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT} (PID: ${process.pid})`);
});

function shutdown(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing server...`);
  io.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
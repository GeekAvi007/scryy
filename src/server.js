import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import { registerSocketHandlers } from './sockets/socketHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Attach Socket.io to the raw HTTP server
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Serve frontend files from /public
app.use(express.static(path.join(__dirname, '../public')));

// Hand off every new WebSocket connection to our socket router
io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
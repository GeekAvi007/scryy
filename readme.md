# Scryy — Real-Time Multiplayer Drawing & Guessing Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-scryy.onrender.com-2ea44f?style=for-the-badge)](https://scryy.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Redis](https://img.shields.io/badge/Redis-Pub%2FSub-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech/)

A stateful, server-authoritative multiplayer drawing and guessing backend built with **Node.js**, **Express**, **Socket.io**, **Redis Pub/Sub**, and **PostgreSQL**. Engineered for horizontal WebSocket scalability, sub-millisecond normalized canvas streaming, fault-tolerant 15-second session recovery, and hybrid guest/authenticated play.

**Live Application:** [https://scryy.onrender.com](https://scryy.onrender.com)  
**Health Telemetry:** [https://scryy.onrender.com/health](https://scryy.onrender.com/health)

> **Note on Cold Starts:** Hosted on Render's free tier, which spins down after 15 minutes of inactivity. The initial page load may take 30–50 seconds to wake the container; once active, WebSocket events and canvas rendering run in real time.

---

## System Architecture

Scryy separates **hot, ephemeral match state** (in-memory `Map` structures synchronized across processes via Redis Pub/Sub) from **cold, durable career data** (persisted asynchronously to PostgreSQL over standard REST endpoints).

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (public/client.js)                      │
│  • REST Fetch (/api/auth/*, /api/leaderboard)  ──► localStorage (JWT)   │
│  • Socket.io Client (draw, chat, room events)  ──► sessionStorage (UUID)│
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │ HTTP (JSON)                     │ WebSocket (Bidirectional)
                    ▼                                 ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│     EXPRESS REST LAYER            │ │     SOCKET.IO EVENT LAYER         │
│  • src/routes/authRoutes.js       │ │  • src/sockets/socketHandler.js   │
│    - POST /api/auth/register      │ │    ├── roomEvents.js              │
│    - POST /api/auth/login         │ │    ├── drawEvents.js              │
│    - GET  /api/leaderboard        │ │    └── chatEvents.js              │
└───────────────────┬───────────────┘ └─────────────────┬─────────────────┘
                    │                                   │
                    │                 ┌─────────────────▼─────────────────┐
                    │                 │   SECURITY & DOMAIN STATE (RAM)   │
                    │                 │  • rateLimiter.js (Sliding Window)│
                    │                 │  • RoomManager.js (O(1) Lookups)  │
                    │                 │  • Room.js (Players, Strokes, FSM)│
                    │                 └─────────────────┬─────────────────┘
                    │                                   │
                    │                 ┌─────────────────▼─────────────────┐
                    │                 │   AUTONOMOUS ENGINE               │
                    │                 │  • GameLoop.js (1s Clock & Turns) │
                    │                 │  • ScoreCalculator.js (Levenshtein│
                    │                 │    & Time-Decay Points)           │
                    │                 └─────────┬───────────────┬─────────┘
                    ▼                           ▼               ▼
         ┌─────────────────────┐     ┌──────────────────┐ ┌───────────────┐
         │   NEON POSTGRESQL   │◄────┘   (On GAME_OVER) │ │ UPSTASH REDIS │
         │  src/db/postgres.js │     └──────────────────┘ │  (Pub/Sub)    │
         └─────────────────────┘                          └───────────────┘
```

---

## Core Engineering Highlights

* **Server-Authoritative Finite State Machine (`GameLoop.js`):** Rooms transition deterministically across `LOBBY → WORD_SELECT → DRAWING → ROUND_END → GAME_OVER` driven by a single server-side 1-second clock. Secret words remain strictly in server memory and are never exposed to active guessers.
* **Normalized Canvas Streaming & Catch-Up Sync (`drawEvents.js`):** Mouse coordinates are normalized to `0.0–1.0` floats on the client for resolution-independent rendering across mobile and desktop screens. Strokes are validated for drawer ownership, clamped, broadcast via sender-excluded channels (`socket.to(roomCode)`), and stored in `strokeHistory` (capped at 5,000 strokes/round) for instant late-join or post-refresh replay.
* **Decoupled Session Identity & 15s Refresh Recovery (`RoomManager.js`):** Player state is keyed by a durable `playerId` UUID rather than a volatile `socket.id`. Upon disconnect, a 15-second grace timer holds the player's seat, score, host status, and active drawing turn; reloading the browser within that window automatically rebinds the new socket via `playerToken` and rehydrates canvas and secret-word state.
* **Chat Interception & Guessing Heuristics (`chatEvents.js`, `ScoreCalculator.js`):** Every chat message is evaluated server-side before broadcast. Exact matches award time-decay points (`50–500 pts`), block the answer from appearing in public chat, and trigger early round completion if all guessers solve the word. Dynamic-programming **Levenshtein edit distance (`= 1`)** privately whispers close-guess hints without leaking the answer.
* **Application-Layer Rate Limiting & Concurrency Guards (`rateLimiter.js`):** A zero-dependency, per-socket sliding-window rate limiter throttles high-frequency `draw_stroke` (120/s), `send_message` (5/3s), and room-action events, purging tracking maps on disconnect. Mid-turn drawer disconnects and sub-minimum player counts abort cleanly without leaving orphaned intervals.
* **Horizontal Scaling & Hybrid Persistence (`redisAdapter.js`, `postgres.js`):** Attaches `@socket.io/redis-adapter` using dual `pubClient`/`subClient` connections for multi-instance broadcasting (with automatic fallback to single-node memory mode if `REDIS_URL` is unset). Authenticated users earn persistent `games_played`, `words_guessed`, and `total_score` updates in PostgreSQL at `GAME_OVER`.

---

## Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Runtime & Framework** | Node.js (ES Modules), Express |
| **Real-Time Transport** | Socket.io |
| **Horizontal Scaling** | Redis Pub/Sub (`@socket.io/redis-adapter`, `redis`) |
| **Database & Auth** | PostgreSQL (`pg`), JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| **Frontend Client** | HTML5 Canvas, Vanilla JavaScript (`sessionStorage` / `localStorage`) |
| **Deployment & Infra** | Render (Web Service), Upstash (Managed Redis), Neon (Serverless Postgres), Docker |

---

## Project Structure

```text
scryy/
├── public/
│   ├── index.html               # Lobby, global leaderboard, canvas, and chat UI
│   └── client.js                # Normalized canvas renderer, Socket.io & REST client
├── src/
│   ├── config/
│   │   ├── constants.js         # Round durations, rate-limit thresholds, FSM states
│   │   └── redisAdapter.js      # Dual-client Redis Pub/Sub setup with graceful fallback
│   ├── data/
│   │   └── words.js             # Curated word bank & random sampling helper
│   ├── db/
│   │   └── postgres.js          # pg.Pool connection, auto-schema init, stat persistence
│   ├── engine/
│   │   ├── GameLoop.js          # Autonomous turn rotation, hints, and disconnect recovery
│   │   └── ScoreCalculator.js   # Time-decay scoring & Levenshtein distance algorithm
│   ├── routes/
│   │   └── authRoutes.js        # /api/auth/register, /api/auth/login, /api/leaderboard
│   ├── sockets/
│   │   ├── socketHandler.js     # Connection lifecycle & 15s disconnect grace orchestration
│   │   ├── roomEvents.js        # Room creation, joining, JWT binding, and reconnection
│   │   ├── drawEvents.js        # Drawer authorization, payload sanitization, stroke relay
│   │   └── chatEvents.js        # Guess validation, leak prevention, close-guess whispers
│   ├── state/
│   │   ├── Room.js              # Encapsulated room entity & sanitized public DTO
│   │   └── RoomManager.js       # O(1) room/socket lookup maps & eviction timers
│   ├── utils/
│   │   ├── rateLimiter.js       # Per-socket sliding-window event rate limiter
│   │   └── roomCodeGenerator.js # Collision-free 6-character alphanumeric room codes
│   └── server.js                # HTTP/WS server entry point, /health check, graceful shutdown
├── Dockerfile
└── package.json
```

---

## API & WebSocket Protocol Reference

### HTTP REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Returns server `pid`, `postgresConnected` status, `activeRooms`, `connectedSockets`, and `uptimeSec`. |
| `POST` | `/api/auth/register` | Creates a new user account (`username`, `password`) with `bcryptjs` hashing and returns a signed 7-day JWT. |
| `POST` | `/api/auth/login` | Authenticates user credentials and returns a signed JWT + career stats. |
| `GET` | `/api/leaderboard` | Fetches the top 10 all-time players ordered by `total_score` from PostgreSQL. |

### Key WebSocket Events

* **Client $\rightarrow$ Server:** `create_room`, `join_room`, `reconnect_player`, `start_game`, `select_word`, `draw_stroke`, `clear_canvas`, `send_message`
* **Server $\rightarrow$ Client:** `session_credentials`, `room_joined`, `room_updated`, `word_choices` *(drawer only)*, `secret_word` *(drawer & solved guessers only)*, `hint_updated`, `draw_stroke`, `canvas_sync`, `canvas_cleared`, `correct_guess`, `round_ended`, `game_over`

---

## Local Development Setup

1. **Clone the repository and install dependencies:**
   ```bash
   git clone [https://github.com/GeekAvi007/scryy.git](https://github.com/GeekAvi007/scryy.git)
   cd scryy
   npm install
   ```

2. **Create a `.env` file in the root directory:**
   ```env
   PORT=3000
   DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=verify-full
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=replace_with_a_64_byte_random_hex_string
   ```
   *(Generate a secure `JWT_SECRET` locally with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.)*

   > **Zero-Dependency Local Mode:** Both `DATABASE_URL` and `REDIS_URL` are optional. If omitted, Scryy automatically falls back to single-node in-memory mode with full guest gameplay enabled.

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in two browser tabs to test real-time drawing, guessing, turn rotation, and mid-turn tab refresh recovery.

---

## Docker Build

```bash
docker build -t scryy-engine .
docker run -p 3000:3000 --env-file .env scryy-engine
```
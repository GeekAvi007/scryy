const socket = io();

const errorBanner = document.getElementById('errorBanner');
const lobbyScreen = document.getElementById('lobbyScreen');
const roomScreen = document.getElementById('roomScreen');

const usernameInput = document.getElementById('usernameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');

const guestAuthForm = document.getElementById('guestAuthForm');
const loggedInBar = document.getElementById('loggedInBar');
const loggedInUsername = document.getElementById('loggedInUsername');
const guestNameRow = document.getElementById('guestNameRow');
const authUserInput = document.getElementById('authUserInput');
const authPassInput = document.getElementById('authPassInput');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const globalLeaderboardBody = document.getElementById('globalLeaderboardBody');

const displayRoomCode = document.getElementById('displayRoomCode');
const roundDisplay = document.getElementById('roundDisplay');
const statusDisplay = document.getElementById('statusDisplay');
const wordDisplay = document.getElementById('wordDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const playerList = document.getElementById('playerList');

const lobbyControls = document.getElementById('lobbyControls');
const lobbyWaitText = document.getElementById('lobbyWaitText');
const startGameBtn = document.getElementById('startGameBtn');

const wordSelectBox = document.getElementById('wordSelectBox');
const wordChoicesContainer = document.getElementById('wordChoicesContainer');

const gameOverBox = document.getElementById('gameOverBox');
const leaderboardList = document.getElementById('leaderboardList');
const playAgainBtn = document.getElementById('playAgainBtn');

const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const drawerToolbar = document.getElementById('drawerToolbar');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const clearBtn = document.getElementById('clearBtn');

const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

const SESSION_KEY = 'skribbl_session';
const AUTH_KEY = 'skribbl_auth';

let myPlayerId = null;
let canDraw = false;
let isDrawing = false;
let lastPos = null;
let knownSecretWord = null;

function getSavedAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
  } catch {
    return null;
  }
}

function syncAuthUI() {
  const auth = getSavedAuth();
  if (auth?.token && auth?.user) {
    guestAuthForm.style.display = 'none';
    guestNameRow.style.display = 'none';
    loggedInBar.style.display = 'block';
    loggedInUsername.textContent = auth.user.username;
  } else {
    guestAuthForm.style.display = 'block';
    guestNameRow.style.display = 'block';
    loggedInBar.style.display = 'none';
  }
}

async function handleAuth(endpoint) {
  errorBanner.textContent = '';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: authUserInput.value,
        password: authPassInput.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorBanner.textContent = data.error || 'Authentication failed.';
      return;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.token, user: data.user }));
    authPassInput.value = '';
    syncAuthUI();
  } catch {
    errorBanner.textContent = 'Network error during authentication.';
  }
}

async function loadGlobalLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    globalLeaderboardBody.innerHTML = '';

    if (!data.leaderboard || data.leaderboard.length === 0) {
      globalLeaderboardBody.innerHTML = '<tr><td colspan="4">No ranked games yet.</td></tr>';
      return;
    }

    data.leaderboard.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.username}</td>
        <td>${row.games_played}</td>
        <td>${row.words_guessed}</td>
        <td><strong>${row.total_score}</strong></td>
      `;
      globalLeaderboardBody.appendChild(tr);
    });
  } catch {
    globalLeaderboardBody.innerHTML = '<tr><td colspan="4">Leaderboard offline.</td></tr>';
  }
}

function appendChatLine(text, className = '') {
  const div = document.createElement('div');
  div.className = `chat-msg ${className}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function renderRoomState(room) {
  errorBanner.textContent = '';
  lobbyScreen.style.display = 'none';
  roomScreen.style.display = 'block';

  const isHost = room.hostId === myPlayerId;
  const isDrawer = room.currentDrawerId === myPlayerId;
  canDraw = isDrawer && room.status === 'DRAWING';

  displayRoomCode.textContent = room.roomCode;
  roundDisplay.textContent = `${room.roundNumber}/${room.totalRounds}`;
  statusDisplay.textContent = room.status;
  timerDisplay.textContent = room.timeLeft;

  if (room.status === 'WORD_SELECT' || room.status === 'LOBBY') {
    knownSecretWord = null;
  }

  if (room.status === 'LOBBY') {
    wordDisplay.textContent = 'WAITING FOR PLAYERS';
  } else if (room.status === 'WORD_SELECT') {
    wordDisplay.textContent = isDrawer ? 'PICK A WORD BELOW' : 'DRAWER IS CHOOSING...';
  } else {
    wordDisplay.textContent = knownSecretWord || room.maskedWord;
  }

  lobbyControls.style.display = room.status === 'LOBBY' ? 'block' : 'none';
  startGameBtn.style.display = isHost && room.status === 'LOBBY' ? 'inline-block' : 'none';
  lobbyWaitText.textContent = isHost
    ? 'Click Start Game once at least 2 players have joined.'
    : 'Waiting for the host to start the game...';

  if (!isDrawer || room.status !== 'WORD_SELECT') {
    wordSelectBox.style.display = 'none';
  }

  gameOverBox.style.display = room.status === 'GAME_OVER' ? 'block' : 'none';
  playAgainBtn.style.display = isHost && room.status === 'GAME_OVER' ? 'inline-block' : 'none';

  drawerToolbar.style.display = canDraw ? 'flex' : 'none';
  canvas.style.cursor = canDraw ? 'crosshair' : 'not-allowed';

  playerList.innerHTML = '';
  room.players.forEach((p) => {
    const li = document.createElement('li');
    const authTag = p.isAuthenticated ? ' ⭐' : '';
    const hostTag = p.id === room.hostId ? ' (HOST)' : '';
    const drawerTag = p.id === room.currentDrawerId ? ' 🎨' : '';
    const youTag = p.id === myPlayerId ? ' [YOU]' : '';
    const guessedTag = p.hasGuessed ? ' ✅' : '';
    const offlineTag = p.connected ? '' : ' ⏳ (reconnecting...)';
    li.textContent = `${p.username}${authTag}${hostTag}${drawerTag}${youTag}${guessedTag}${offlineTag} — ${p.score} pts`;
    playerList.appendChild(li);
  });
}

function getNormalizedCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / canvas.width,
    y: (e.clientY - rect.top) / canvas.height,
  };
}

function drawLineSegment({ x0, y0, x1, y1, color, size }) {
  ctx.beginPath();
  ctx.moveTo(x0 * canvas.width, y0 * canvas.height);
  ctx.lineTo(x1 * canvas.width, y1 * canvas.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.closePath();
}

canvas.addEventListener('mousedown', (e) => {
  if (!canDraw) return;
  isDrawing = true;
  lastPos = getNormalizedCoords(e);
});

canvas.addEventListener('mousemove', (e) => {
  if (!canDraw || !isDrawing || !lastPos) return;
  const currentPos = getNormalizedCoords(e);

  const stroke = {
    x0: lastPos.x,
    y0: lastPos.y,
    x1: currentPos.x,
    y1: currentPos.y,
    color: colorPicker.value,
    size: Number(sizePicker.value),
  };

  drawLineSegment(stroke);
  socket.emit('draw_stroke', stroke);
  lastPos = currentPos;
});

window.addEventListener('mouseup', () => {
  isDrawing = false;
  lastPos = null;
});

clearBtn.addEventListener('click', () => {
  if (!canDraw) return;
  socket.emit('clear_canvas');
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = chatInput.value;
  if (!message.trim()) return;
  socket.emit('send_message', { message });
  chatInput.value = '';
});

loginBtn.addEventListener('click', () => handleAuth('/api/auth/login'));
registerBtn.addEventListener('click', () => handleAuth('/api/auth/register'));
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(AUTH_KEY);
  syncAuthUI();
});

createRoomBtn.addEventListener('click', () => {
  const auth = getSavedAuth();
  socket.emit('create_room', {
    username: usernameInput.value,
    authToken: auth?.token || null,
  });
});

joinRoomBtn.addEventListener('click', () => {
  const auth = getSavedAuth();
  socket.emit('join_room', {
    roomCode: roomCodeInput.value,
    username: usernameInput.value,
    authToken: auth?.token || null,
  });
});

startGameBtn.addEventListener('click', () => {
  socket.emit('start_game');
});

playAgainBtn.addEventListener('click', () => {
  socket.emit('start_game');
});

// Attempt automatic reconnection if tab was refreshed
socket.on('connect', () => {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      const { roomCode, playerToken } = JSON.parse(saved);
      if (roomCode && playerToken) {
        socket.emit('reconnect_player', { roomCode, playerToken });
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }
});

socket.on('session_credentials', ({ roomCode, playerId, playerToken }) => {
  myPlayerId = playerId;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId, playerToken }));
});

socket.on('reconnect_failed', () => {
  sessionStorage.removeItem(SESSION_KEY);
});

socket.on('room_joined', renderRoomState);
socket.on('room_updated', renderRoomState);

socket.on('timer_tick', ({ timeLeft }) => {
  timerDisplay.textContent = timeLeft;
});

socket.on('word_choices', ({ words }) => {
  wordChoicesContainer.innerHTML = '';
  words.forEach((word) => {
    const btn = document.createElement('button');
    btn.className = 'word-choice-btn';
    btn.textContent = word.toUpperCase();
    btn.addEventListener('click', () => {
      socket.emit('select_word', { word });
      wordSelectBox.style.display = 'none';
    });
    wordChoicesContainer.appendChild(btn);
  });
  wordSelectBox.style.display = 'block';
});

socket.on('secret_word', ({ word }) => {
  knownSecretWord = word.toUpperCase();
  wordDisplay.textContent = knownSecretWord;
});

socket.on('hint_updated', ({ maskedWord }) => {
  if (!knownSecretWord) {
    wordDisplay.textContent = maskedWord;
  }
});

socket.on('round_ended', ({ reason, word }) => {
  knownSecretWord = word?.toUpperCase() || '';
  wordDisplay.textContent = knownSecretWord;
  appendChatLine(`🔔 Round ended (${reason}) — The word was: ${knownSecretWord}`, 'chat-notice');
});

socket.on('game_over', ({ leaderboard }) => {
  leaderboardList.innerHTML = '';
  leaderboard.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = `${p.username} — ${p.score} pts`;
    leaderboardList.appendChild(li);
  });
  gameOverBox.style.display = 'block';
  loadGlobalLeaderboard();
});

socket.on('room_error', ({ message }) => {
  errorBanner.textContent = message;
});

socket.on('chat_message', ({ sender, text }) => {
  appendChatLine(`${sender}: ${text}`);
});

socket.on('correct_guess', ({ username, pointsEarned }) => {
  appendChatLine(`🎉 ${username} guessed the word! (+${pointsEarned} pts)`, 'chat-success');
});

socket.on('system_notice', ({ text }) => {
  appendChatLine(`⚠️ ${text}`, 'chat-notice');
});

socket.on('draw_stroke', drawLineSegment);

socket.on('canvas_sync', (strokes) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach(drawLineSegment);
});

socket.on('canvas_cleared', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Initialize auth UI & global leaderboard on page load
syncAuthUI();
loadGlobalLeaderboard();
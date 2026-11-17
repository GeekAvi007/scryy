const socket = io();

const errorBanner = document.getElementById('errorBanner');
const lobbyScreen = document.getElementById('lobbyScreen');
const roomScreen = document.getElementById('roomScreen');

const usernameInput = document.getElementById('usernameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');

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

let canDraw = false;
let isDrawing = false;
let lastPos = null;
let knownSecretWord = null;

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

  const isHost = room.hostId === socket.id;
  const isDrawer = room.currentDrawerId === socket.id;
  canDraw = isDrawer && room.status === 'DRAWING';

  displayRoomCode.textContent = room.roomCode;
  roundDisplay.textContent = `${room.roundNumber}/${room.totalRounds}`;
  statusDisplay.textContent = room.status;
  timerDisplay.textContent = room.timeLeft;

  // Reset knownSecretWord when a new turn begins
  if (room.status === 'WORD_SELECT' || room.status === 'LOBBY') {
    knownSecretWord = null;
  }

  // Top banner word display
  if (room.status === 'LOBBY') {
    wordDisplay.textContent = 'WAITING FOR PLAYERS';
  } else if (room.status === 'WORD_SELECT') {
    wordDisplay.textContent = isDrawer ? 'PICK A WORD BELOW' : 'DRAWER IS CHOOSING...';
  } else {
    wordDisplay.textContent = knownSecretWord || room.maskedWord;
  }

  // Lobby start controls
  lobbyControls.style.display = room.status === 'LOBBY' ? 'block' : 'none';
  startGameBtn.style.display = isHost && room.status === 'LOBBY' ? 'inline-block' : 'none';
  lobbyWaitText.textContent = isHost
    ? 'Click Start Game once at least 2 players have joined.'
    : 'Waiting for the host to start the game...';

  // Hide word picker unless actively selecting
  if (!isDrawer || room.status !== 'WORD_SELECT') {
    wordSelectBox.style.display = 'none';
  }

  // Game Over box visibility
  gameOverBox.style.display = room.status === 'GAME_OVER' ? 'block' : 'none';
  playAgainBtn.style.display = isHost && room.status === 'GAME_OVER' ? 'inline-block' : 'none';

  // Canvas permissions
  drawerToolbar.style.display = canDraw ? 'flex' : 'none';
  canvas.style.cursor = canDraw ? 'crosshair' : 'not-allowed';

  // Player list
  playerList.innerHTML = '';
  room.players.forEach((p) => {
    const li = document.createElement('li');
    const hostTag = p.id === room.hostId ? ' (HOST)' : '';
    const drawerTag = p.id === room.currentDrawerId ? ' 🎨' : '';
    const youTag = p.id === socket.id ? ' [YOU]' : '';
    const guessedTag = p.hasGuessed ? ' ✅' : '';
    li.textContent = `${p.username}${hostTag}${drawerTag}${youTag}${guessedTag} — ${p.score} pts`;
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

createRoomBtn.addEventListener('click', () => {
  socket.emit('create_room', { username: usernameInput.value });
});

joinRoomBtn.addEventListener('click', () => {
  socket.emit('join_room', {
    roomCode: roomCodeInput.value,
    username: usernameInput.value,
  });
});

startGameBtn.addEventListener('click', () => {
  socket.emit('start_game');
});

playAgainBtn.addEventListener('click', () => {
  socket.emit('start_game');
});

// Socket listeners
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
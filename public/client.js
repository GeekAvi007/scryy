const socket = io();

const errorBanner = document.getElementById('errorBanner');
const lobbyScreen = document.getElementById('lobbyScreen');
const roomScreen = document.getElementById('roomScreen');

const usernameInput = document.getElementById('usernameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');

const displayRoomCode = document.getElementById('displayRoomCode');
const roleBadge = document.getElementById('roleBadge');
const wordDisplay = document.getElementById('wordDisplay');
const playerList = document.getElementById('playerList');

const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const drawerToolbar = document.getElementById('drawerToolbar');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const clearBtn = document.getElementById('clearBtn');

const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

let isDrawer = false;
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

  displayRoomCode.textContent = room.roomCode;
  isDrawer = room.currentDrawerId === socket.id;

  roleBadge.textContent = isDrawer ? 'DRAWER' : 'GUESSER';
  drawerToolbar.style.display = isDrawer ? 'flex' : 'none';
  canvas.style.cursor = isDrawer ? 'crosshair' : 'not-allowed';

  // Show real word if known (drawer or already guessed), otherwise masked underscores
  wordDisplay.textContent = knownSecretWord || room.maskedWord;

  playerList.innerHTML = '';
  room.players.forEach((p) => {
    const li = document.createElement('li');
    const isHost = p.id === room.hostId ? ' (HOST)' : '';
    const isYou = p.id === socket.id ? ' [YOU]' : '';
    const guessedTag = p.hasGuessed ? ' ✅' : '';
    li.textContent = `${p.username}${isHost}${isYou}${guessedTag} — ${p.score} pts`;
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
  if (!isDrawer) return;
  isDrawing = true;
  lastPos = getNormalizedCoords(e);
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawer || !isDrawing || !lastPos) return;
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
  if (!isDrawer) return;
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

// Socket listeners
socket.on('room_joined', renderRoomState);
socket.on('room_updated', renderRoomState);

socket.on('secret_word', ({ word }) => {
  knownSecretWord = word;
  wordDisplay.textContent = word;
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
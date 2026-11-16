const socket = io();

const errorBanner = document.getElementById('errorBanner');
const lobbyScreen = document.getElementById('lobbyScreen');
const roomScreen = document.getElementById('roomScreen');

const usernameInput = document.getElementById('usernameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');

const displayRoomCode = document.getElementById('displayRoomCode');
const displayStatus = document.getElementById('displayStatus');
const playerList = document.getElementById('playerList');

function renderRoomState(room) {
  errorBanner.textContent = '';
  lobbyScreen.style.display = 'none';
  roomScreen.style.display = 'block';

  displayRoomCode.textContent = room.roomCode;
  displayStatus.textContent = room.status;

  playerList.innerHTML = '';
  room.players.forEach((p) => {
    const li = document.createElement('li');
    const isHost = p.id === room.hostId ? ' (HOST)' : '';
    const isYou = p.id === socket.id ? ' [YOU]' : '';
    li.textContent = `${p.username}${isHost}${isYou} — ${p.score} pts`;
    playerList.appendChild(li);
  });
}

createRoomBtn.addEventListener('click', () => {
  socket.emit('create_room', { username: usernameInput.value });
});

joinRoomBtn.addEventListener('click', () => {
  socket.emit('join_room', {
    roomCode: roomCodeInput.value,
    username: usernameInput.value,
  });
});

socket.on('room_joined', renderRoomState);
socket.on('room_updated', renderRoomState);

socket.on('room_error', ({ message }) => {
  errorBanner.textContent = message;
});
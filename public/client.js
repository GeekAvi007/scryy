const socket = io();

const statusEl = document.getElementById('status');
const pingBtn = document.getElementById('pingBtn');
const logEl = document.getElementById('log');

function log(msg) {
  logEl.textContent += `${new Date().toLocaleTimeString()} - ${msg}\n`;
}

socket.on('connect', () => {
  statusEl.textContent = `Connected (${socket.id})`;
  log(`Connected to server with ID: ${socket.id}`);
});

socket.on('disconnect', () => {
  statusEl.textContent = 'Disconnected';
  log('Disconnected from server');
});

pingBtn.addEventListener('click', () => {
  log('Sending ping_server...');
  socket.emit('ping_server', { hello: 'server' });
});

socket.on('pong_client', (data) => {
  log(`Received pong_client: ${JSON.stringify(data)}`);
});
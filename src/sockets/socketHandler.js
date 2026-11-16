export function registerSocketHandlers(io, socket) {
    console.log(`[CONNECTED] Socket ID: ${socket.id}`);

    // Handshake test

    socket.on('ping_server', (payload) => {
        console.log(`[PING] From ${socket.id}:`, payload);
        socket.emit('pong_client', {
            message: 'Pong from Node.js backend!',
            yourSocketId: socket.id,
            serverTime: Date.now()
        });
    })

    socket.on('disconnect', (reason) => {
        console.log(`[DISCONNECTED] Socket ID: ${socket.id} | Reason: ${reason}`);
      });

}
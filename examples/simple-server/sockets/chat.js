export function onConnect(socket) {
  console.log(`[chat] ${socket.data.username} connected`)
  socket.join('lobby')
  socket.to('lobby').emit('system', { message: `${socket.data.username} joined the lobby` })
  socket.emit('welcome', { message: `Welcome to chat, ${socket.data.username}` })
}

export function onDisconnect(socket) {
  console.log(`[chat] ${socket.data.username} disconnected`)
  socket.to('lobby').emit('system', { message: `${socket.data.username} left the lobby` })
}

export function sendMessage(socket, data) {
  socket.to('lobby').emit('message', {
    username: socket.data.username,
    text: data.text,
    timestamp: Date.now()
  })
}

export function joinRoom(socket, data) {
  socket.join(data.room)
  socket.emit('joinedRoom', { room: data.room })
}

export function leaveRoom(socket, data) {
  socket.leave(data.room)
  socket.emit('leftRoom', { room: data.room })
}

export function onError(socket, error) {
  console.error(`[chat] error for ${socket.id}:`, error.message)
}

const players = new Map()

export function onConnect(socket) {
  players.set(socket.id, { x: 0, y: 0, username: socket.data.username })
  socket.join('game-room')
  socket.emit('init', { players: Array.from(players.values()) })
  socket.to('game-room').emit('playerJoined', { id: socket.id, username: socket.data.username })
}

export function onDisconnect(socket) {
  players.delete(socket.id)
  socket.to('game-room').emit('playerLeft', { id: socket.id })
}

export function move(socket, data) {
  const player = players.get(socket.id)
  if (!player) return
  player.x = data.x
  player.y = data.y
  socket.to('game-room').emit('playerMoved', { id: socket.id, x: data.x, y: data.y })
}

export function onError(socket, error) {
  console.error(`[game] error for ${socket.id}:`, error.message)
}

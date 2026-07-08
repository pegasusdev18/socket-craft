import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SocketCraft } from '../../index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = new SocketCraft({
  socketsDir: join(__dirname, 'sockets'),
  port: 5050
})

app.use(async (socket, request) => {
  const url = new URL(request.url, 'http://localhost')
  const token = url.searchParams.get('token')
  if (url.searchParams.get('blocked') === 'true') {
    throw new Error('Access denied')
  }
  const username = url.searchParams.get('username') || `guest-${socket.id.slice(0, 5)}`
  socket.data.username = username
  socket.data.token = token || null
  socket.data.connectedAt = Date.now()
})

await app.listen()

console.log('SocketCraft server running at ws://localhost:5050')
console.log('Chat channel:  ws://localhost:5050/chat?username=Alice')
console.log('Game channel:  ws://localhost:5050/game?username=Alice')

setInterval(() => {
  console.log(`Active clients: ${app.store.clientCount()} | Active rooms: ${app.store.roomCount()}`)
}, 15000)

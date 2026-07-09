import { randomUUID } from 'node:crypto'

export class RoomEmitter {
  constructor(socket, room) {
    this.socket = socket
    this.room = room
  }

  emit(event, data) {
    const socket = this.socket
    const store = socket.store
    const room = this.room
    const selfId = socket.id
    const members = store.getRoomMembers(room)
    if (!members) return
    const payload = JSON.stringify({ event, data })
    for (const memberId of members) {
      if (memberId === selfId) continue
      const client = store.getClient(memberId)
      if (client) client.sendRaw(payload)
    }
  }
}

export class BroadcastEmitter {
  constructor(socket) {
    this.socket = socket
  }

  emit(event, data) {
    const socket = this.socket
    const store = socket.store
    const namespace = socket.namespace
    const selfId = socket.id
    const payload = JSON.stringify({ event, data })
    for (const client of store.getAllClients()) {
      if (client.id === selfId) continue
      if (client.namespace !== namespace) continue
      client.sendRaw(payload)
    }
  }
}

export class SocketCraftSocket {
  constructor(rawSocket, options) {
    this.id = randomUUID()
    this.raw = rawSocket
    this.namespace = options.namespace
    this.store = options.store
    this.handlers = options.handlers || null
    this.maxBackpressure = options.maxBackpressure || 1048576
    this.data = {}
    this.rooms = new Set()
    this.params = {}
    this.query = {}
    this.request = null
    this.isAlive = true
    this._broadcastEmitter = new BroadcastEmitter(this)
  }

  _isBackpressured() {
    if (this.raw.bufferedAmount <= this.maxBackpressure) return false
    if (this.handlers && typeof this.handlers.onBackpressure === 'function') {
      this.handlers.onBackpressure(this)
    } else {
      this.raw.close(1009, 'Buffer Overflow')
    }
    return true
  }

  send(event, data) {
    return this.sendRaw(JSON.stringify({ event, data }))
  }

  sendRaw(rawPayload) {
    if (this.raw.readyState !== this.raw.OPEN) return false
    if (this._isBackpressured()) return false
    this.raw.send(rawPayload)
    return true
  }

  sendBinary(buffer) {
    if (this.raw.readyState !== this.raw.OPEN) return false
    if (this._isBackpressured()) return false
    this.raw.send(buffer, { binary: true })
    return true
  }

  emit(event, data) {
    return this.send(event, data)
  }

  join(room) {
    this.rooms.add(room)
    this.store.joinRoom(this.id, room)
  }

  leave(room) {
    this.rooms.delete(room)
    this.store.leaveRoom(this.id, room)
  }

  to(room) {
    return new RoomEmitter(this, room)
  }

  get broadcast() {
    return this._broadcastEmitter
  }

  disconnect(code = 1000, reason = 'Normal closure') {
    this.raw.close(code, reason)
  }
}

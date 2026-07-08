import { randomUUID } from 'node:crypto'

export class SocketCraftSocket {
  constructor(rawSocket, options) {
    this.id = randomUUID()
    this.raw = rawSocket
    this.namespace = options.namespace
    this.store = options.store
    this.data = {}
    this.rooms = new Set()
    this.query = {}
    this.request = null
    this.isAlive = true
  }

  send(event, data) {
    if (this.raw.readyState !== this.raw.OPEN) return
    this.raw.send(JSON.stringify({ event, data }))
  }

  emit(event, data) {
    this.send(event, data)
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
    const store = this.store
    const selfId = this.id
    return {
      emit(event, data) {
        const members = store.getRoomMembers(room)
        if (!members) return
        for (const memberId of members) {
          if (memberId === selfId) continue
          const client = store.getClient(memberId)
          if (client) client.send(event, data)
        }
      }
    }
  }

  get broadcast() {
    const store = this.store
    const namespace = this.namespace
    const selfId = this.id
    return {
      emit(event, data) {
        for (const client of store.getAllClients()) {
          if (client.id === selfId) continue
          if (client.namespace !== namespace) continue
          client.send(event, data)
        }
      }
    }
  }

  disconnect(code = 1000, reason = 'Normal closure') {
    this.raw.close(code, reason)
  }
}

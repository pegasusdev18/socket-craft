export class Store {
  constructor() {
    this.clients = new Map()
    this.rooms = new Map()
    this.clientRooms = new Map()
    this.onJoin = null
    this.onLeave = null
    this.onRoomCreate = null
    this.onRoomDestroy = null
    this.onClientAdd = null
    this.onClientRemove = null
  }

  addClient(socket) {
    this.clients.set(socket.id, socket)
    this.clientRooms.set(socket.id, new Set())
    if (this.onClientAdd) this.onClientAdd(socket.id)
  }

  removeClient(id) {
    const rooms = this.clientRooms.get(id)
    if (rooms) {
      for (const room of [...rooms]) {
        this.leaveRoom(id, room)
      }
    }
    this.clientRooms.delete(id)
    this.clients.delete(id)
    if (this.onClientRemove) this.onClientRemove(id)
  }

  getClient(id) {
    return this.clients.get(id)
  }

  getAllClients() {
    return this.clients.values()
  }

  clientCount() {
    return this.clients.size
  }

  joinRoom(id, room) {
    let isNewRoom = false
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set())
      isNewRoom = true
    }
    this.rooms.get(room).add(id)
    if (!this.clientRooms.has(id)) {
      this.clientRooms.set(id, new Set())
    }
    this.clientRooms.get(id).add(room)
    if (isNewRoom && this.onRoomCreate) this.onRoomCreate(room)
    if (this.onJoin) this.onJoin(id, room)
  }

  leaveRoom(id, room) {
    const members = this.rooms.get(room)
    let destroyed = false
    if (members) {
      members.delete(id)
      if (members.size === 0) {
        this.rooms.delete(room)
        destroyed = true
      }
    }
    const clientRoomSet = this.clientRooms.get(id)
    if (clientRoomSet) {
      clientRoomSet.delete(room)
    }
    if (this.onLeave) this.onLeave(id, room)
    if (destroyed && this.onRoomDestroy) this.onRoomDestroy(room)
  }

  getRoomMembers(room) {
    return this.rooms.get(room)
  }

  getRoomsForClient(id) {
    return this.clientRooms.get(id) || new Set()
  }

  roomCount() {
    return this.rooms.size
  }

  getRooms() {
    return [...this.rooms.keys()]
  }
}

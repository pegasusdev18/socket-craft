export class Store {
  constructor() {
    this.clients = new Map()
    this.rooms = new Map()
    this.clientRooms = new Map()
  }

  addClient(socket) {
    this.clients.set(socket.id, socket)
    this.clientRooms.set(socket.id, new Set())
  }

  removeClient(id) {
    const rooms = this.clientRooms.get(id)
    if (rooms) {
      for (const room of rooms) {
        this.leaveRoom(id, room)
      }
    }
    this.clientRooms.delete(id)
    this.clients.delete(id)
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
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set())
    }
    this.rooms.get(room).add(id)
    if (!this.clientRooms.has(id)) {
      this.clientRooms.set(id, new Set())
    }
    this.clientRooms.get(id).add(room)
  }

  leaveRoom(id, room) {
    const members = this.rooms.get(room)
    if (members) {
      members.delete(id)
      if (members.size === 0) {
        this.rooms.delete(room)
      }
    }
    const clientRoomSet = this.clientRooms.get(id)
    if (clientRoomSet) {
      clientRoomSet.delete(room)
    }
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

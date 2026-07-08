import { WebSocketServer } from 'ws'
import { createServer } from 'node:http'
import { Router } from './router.js'
import { Store } from './store.js'
import { SocketCraftSocket } from './socket.js'

export class SocketCraftServer {
  constructor(options = {}) {
    this.options = {
      socketsDir: options.socketsDir || './sockets',
      server: options.server || null,
      port: options.port || 4000,
      pingInterval: options.pingInterval || 30000,
      basePath: options.basePath || '',
      ...options
    }
    this.store = new Store()
    this.router = new Router(this.options.socketsDir)
    this.middlewares = []
    this.wss = null
    this.httpServer = null
    this.pingTimer = null
  }

  use(fn) {
    this.middlewares.push(fn)
    return this
  }

  async listen(port) {
    await this.router.load()
    this.httpServer = this.options.server || createServer()
    this.wss = new WebSocketServer({ server: this.httpServer })
    this.wss.on('connection', (raw, request) => this.#handleConnection(raw, request))
    this.#startHeartbeat()
    const listenPort = port || this.options.port
    if (!this.options.server) {
      await new Promise((resolve) => this.httpServer.listen(listenPort, resolve))
    }
    return this.httpServer
  }

  async #handleConnection(raw, request) {
    const url = new URL(request.url, 'http://localhost')
    let pathname = url.pathname
    if (this.options.basePath && pathname.startsWith(this.options.basePath)) {
      pathname = pathname.slice(this.options.basePath.length) || '/'
    }
    const namespace = pathname

    if (!this.router.hasNamespace(namespace)) {
      raw.close(1008, `Unknown namespace: ${namespace}`)
      return
    }

    const socket = new SocketCraftSocket(raw, { namespace, store: this.store })
    socket.query = Object.fromEntries(url.searchParams.entries())
    socket.request = request

    try {
      for (const middleware of this.middlewares) {
        await middleware(socket, request)
      }
    } catch (error) {
      raw.close(1008, error.message || 'Unauthorized')
      return
    }

    this.store.addClient(socket)
    const handlers = this.router.getNamespace(namespace)

    if (typeof handlers.onConnect === 'function') {
      await handlers.onConnect(socket)
    }

    raw.on('message', async (rawMessage) => {
      let parsed
      try {
        parsed = JSON.parse(rawMessage.toString())
      } catch {
        return
      }
      const { event, data } = parsed
      if (!event) return
      const handler = handlers[event]
      if (typeof handler === 'function') {
        try {
          await handler(socket, data)
        } catch (error) {
          if (typeof handlers.onError === 'function') {
            handlers.onError(socket, error)
          }
        }
      }
    })

    raw.on('pong', () => {
      socket.isAlive = true
    })

    raw.on('close', async () => {
      this.store.removeClient(socket.id)
      if (typeof handlers.onDisconnect === 'function') {
        await handlers.onDisconnect(socket)
      }
    })

    raw.on('error', (error) => {
      if (typeof handlers.onError === 'function') {
        handlers.onError(socket, error)
      }
    })
  }

  #startHeartbeat() {
    this.pingTimer = setInterval(() => {
      for (const client of this.store.getAllClients()) {
        if (!client.isAlive) {
          client.raw.terminate()
          continue
        }
        client.isAlive = false
        client.raw.ping()
      }
    }, this.options.pingInterval)
  }

  to(room) {
    const store = this.store
    return {
      emit(event, data) {
        const members = store.getRoomMembers(room)
        if (!members) return
        for (const memberId of members) {
          const client = store.getClient(memberId)
          if (client) client.send(event, data)
        }
      }
    }
  }

  namespace(name) {
    const store = this.store
    return {
      emit(event, data) {
        for (const client of store.getAllClients()) {
          if (client.namespace === name) client.send(event, data)
        }
      }
    }
  }

  async close() {
    clearInterval(this.pingTimer)
    for (const client of this.store.getAllClients()) {
      client.raw.terminate()
    }
    await new Promise((resolve) => this.wss.close(resolve))
    if (!this.options.server) {
      await new Promise((resolve) => this.httpServer.close(resolve))
    }
  }
}

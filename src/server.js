import { WebSocketServer } from 'ws'
import { createServer } from 'node:http'
import { Router } from './router.js'
import { Store } from './store.js'
import { SocketCraftSocket } from './socket.js'

function validatePayload(schema, data) {
  if (!schema) return true
  if (data === null || Array.isArray(data)) return false
  if (typeof data !== 'object') return false
  for (const key in schema) {
    const expectedType = schema[key]
    const value = data[key]
    if (expectedType === 'array') {
      if (!Array.isArray(value)) return false
      continue
    }
    if (expectedType === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
      continue
    }
    if (typeof value !== expectedType) return false
  }
  return true
}

export class SocketCraftServer {
  constructor(options = {}) {
    this.options = {
      socketsDir: options.socketsDir || './sockets',
      server: options.server || null,
      port: options.port || 4000,
      pingInterval: options.pingInterval || 30000,
      basePath: options.basePath || '',
      maxBackpressure: options.maxBackpressure || 1048576,
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

    const matched = this.router.match(pathname)
    if (!matched) {
      raw.close(1008, `Unknown namespace: ${pathname}`)
      return
    }

    const handlers = matched.module

    const socket = new SocketCraftSocket(raw, {
      namespace: pathname,
      store: this.store,
      handlers,
      maxBackpressure: this.options.maxBackpressure
    })
    socket.params = matched.params
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

    if (typeof handlers.onConnect === 'function') {
      await handlers.onConnect(socket)
    }

    raw.on('message', async (rawMessage, isBinary) => {
      if (isBinary) {
        if (typeof handlers.onRawMessage === 'function') {
          try {
            await handlers.onRawMessage(socket, rawMessage)
          } catch (error) {
            if (typeof handlers.onError === 'function') {
              handlers.onError(socket, error)
            }
          }
        }
        return
      }

      let parsed
      try {
        parsed = JSON.parse(rawMessage.toString())
      } catch {
        if (typeof handlers.onRawMessage === 'function') {
          try {
            await handlers.onRawMessage(socket, rawMessage)
          } catch (error) {
            if (typeof handlers.onError === 'function') {
              handlers.onError(socket, error)
            }
          }
        }
        return
      }

      const event = parsed.event
      const data = parsed.data

      if (!event) return

      const handler = handlers[event]
      if (typeof handler !== 'function') return

      if (handlers.schemas && handlers.schemas[event]) {
        const isValid = validatePayload(handlers.schemas[event], data)
        if (!isValid) {
          socket.send('validationError', { event, message: 'Payload validation failed' })
          if (typeof handlers.onError === 'function') {
            handlers.onError(socket, new Error(`Validation failed for event: ${event}`))
          }
          return
        }
      }

      try {
        await handler(socket, data)
      } catch (error) {
        if (typeof handlers.onError === 'function') {
          handlers.onError(socket, error)
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
        const payload = JSON.stringify({ event, data })
        for (const memberId of members) {
          const client = store.getClient(memberId)
          if (client) client.sendRaw(payload)
        }
      }
    }
  }

  namespace(name) {
    const store = this.store
    return {
      emit(event, data) {
        const payload = JSON.stringify({ event, data })
        for (const client of store.getAllClients()) {
          if (client.namespace === name) client.sendRaw(payload)
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

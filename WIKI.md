# 📖 SocketCraft Comprehensive Wiki & Documentation

Welcome to the official **SocketCraft** documentation. This guide covers everything from core architectural concepts to advanced usage patterns.

---

## 🧭 Table of Contents
1. [Core Architectural Concepts](#1-core-architectural-concepts)
2. [API Reference](#2-api-reference)
   - [SocketCraft Server](#socketcraft-server-options)
   - [SocketCraft Socket (Enhanced Client)](#socketcraft-socket-api)
   - [In-Memory Store](#the-in-memory-store-api)
3. [Lifecycle Hooks & Event Routing](#3-lifecycle-hooks--event-routing)
4. [Advanced Guide: Building an Auth Middleware](#4-advanced-guide-building-an-auth-middleware)

---

## 1. Core Architectural Concepts

SocketCraft is designed around the **declarative file-system routing** paradigm. 

Instead of manually registering namespaces and matching strings to events like this:
```javascript
// The old, tedious way:
io.of('/chat').on('connection', (socket) => {
  socket.on('message', (data) => { ... });
});
```

SocketCraft automates this by analyzing your directory structure. If you create a file named `sockets/chat.js`, SocketCraft dynamically mounts it as the `/chat` namespace. Every exported function inside `chat.js` automatically becomes an event listener for that namespace.

---

## 2. API Reference

### SocketCraft Server (Options)

To initialize a new server instance:

```javascript
import { SocketCraft } from 'socket-craft';

const server = new SocketCraft({
  socketsDir: './custom-sockets-folder', // Default: './sockets'
  port: 5050,                             // Default: 4000
  pingInterval: 15000,                    // Connection heart-rate check (ms). Default: 30000
  basePath: '/api/v1'                     // Optional URL prefix for routing
});
```

#### Server Instance Methods:
- `.use(middlewareFunction)`: Registers a global async middleware (e.g., for JWT auth).
- `.listen(port)`: Starts the underlying HTTP and WebSocket server.
- `.close()`: Terminates all active connections gracefully and closes the ports.
- `.to(room).emit(event, data)`: Broadcasts an event to all clients in a specific room across all namespaces.
- `.namespace(name).emit(event, data)`: Broadcasts an event to all clients in a specific namespace.

---

### SocketCraft Socket (Enhanced Client API)

When a client connects, SocketCraft wraps the raw WebSocket in an enhanced `SocketCraftSocket` instance.

#### Properties:
- `socket.id`: Unique UUID generated for the client session.
- `socket.namespace`: The active namespace/route (e.g., `/chat`).
- `socket.query`: Key-value object of URL query parameters (e.g., `?token=123` -> `socket.query.token`).
- `socket.data`: A safe, empty object (`{}`) reserved for developer metadata (e.g., storing user profiles after auth middleware).

#### Methods:
- `socket.emit(event, data)`: Sends an event directly back to this client.
- `socket.join(room)`: Adds the client to a logical room/channel.
- `socket.leave(room)`: Removes the client from a room.
- `socket.to(room).emit(event, data)`: Emits an event to everyone in the room **except** this client.
- `socket.broadcast.emit(event, data)`: Emits an event to everyone in the active namespace **except** this client.
- `socket.disconnect(code, reason)`: Gracefully terminates the connection.

---

### The In-Memory Store API

SocketCraft keeps track of active connections inside a highly-optimized in-memory Store (`app.store`). You can access it directly to query the real-time state of your cluster.

- `app.store.clientCount()`: Returns the number of total connected clients.
- `app.store.roomCount()`: Returns the number of active rooms.
- `app.store.getRooms()`: Returns an array of active room names.
- `app.store.getRoomMembers(roomName)`: Returns a Set of socket IDs active inside the target room.

---

## 3. Lifecycle Hooks & Event Routing

Every file inside your `/sockets` directory can export specific **lifecycle hooks** alongside custom event handlers:

```javascript
// sockets/dashboard.js

// 1. Triggered immediately when a connection handshakes successfully
export async function onConnect(socket) {
  console.log(`User ${socket.id} connected to dashboard`);
}

// 2. Triggered when the connection drops
export async function onDisconnect(socket) {
  console.log(`User ${socket.id} disconnected`);
}

// 3. Triggered if any handler inside this namespace throws an unhandled error
export function onError(socket, error) {
  console.error(`Error in namespace: ${error.message}`);
}

// 4. Custom Event Handler: Triggered when client sends {"event": "fetchData", "data": {...}}
export function fetchData(socket, data) {
  const reports = { status: "healthy", tasks: 42 };
  socket.emit('dataResponse', reports);
}
```

---

## 4. Advanced Guide: Building an Auth Middleware

Middlewares execute sequentially before the `onConnect` lifecycle hook. If a middleware throws an error, the connection is instantly rejected with code `1008` (Policy Violation).

Here is how to secure your namespaces with a simple JSON Web Token (JWT) validation middleware:

```javascript
import { SocketCraft } from 'socket-craft';
import jwt from 'jsonwebtoken';

const app = new SocketCraft({ port: 8080 });

// Secure Middleware Pipeline
app.use(async (socket, request) => {
  const token = socket.query.token;

  if (!token) {
    throw new Error('Authentication token required');
  }

  try {
    const decodedUser = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the validated user securely to the socket session
    socket.data.user = decodedUser;
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
});

await app.listen();
```

# 🔌⚡ SocketCraft

The zero-config, file-based routing WebSocket framework for modern Node.js ESM applications, built on top of the ultra-fast `ws` engine.

SocketCraft brings the ease of **Next.js-style file-based routing** to real-time communication. No more endless `socket.on` event registers—just create files and write your logic.

---

## ✨ Features

- **📂 File-Based Routing**: Your directory structure defines your WebSocket namespaces and event channels.
- **🛡️ Built-in Middleware Pipeline**: Easily validate sessions, parse query tokens, and secure connections before they hit handlers.
- **🚀 High Performance**: Engineered on top of native Node.js and `ws` for maximum throughput and low latency.
- **💾 Auto State Management**: Dynamic in-memory store tracking connected clients, namespaces, and active rooms.
- **💓 Active Heartbeat**: Automatic ping-pong monitoring to gracefully handle half-open network drops.

---

## 📂 Project Structure

```text
socket-craft/
├── index.js             # Main entry point exporting SocketCraft Class
├── package.json
└── src/
    ├── server.js        # Core server and HTTP handshake coordinator
    ├── router.js        # Dynamic ESM importer and route mapper
    ├── socket.js        # Enhanced client wrappers (emit, broadcast, rooms)
    └── store.js         # Map-based high-performance state store
```

---

## ⚙️ Quick Start

Install the package:

```bash
npm install socket-craft
```

Create your first handler under `./sockets/chat.js`:

```javascript
// Automatically handles the "/chat" namespace!

export function onConnect(socket) {
  socket.join('lobby');
  socket.emit('welcome', { message: `Connected to dynamic channel!` });
}

export function sendMessage(socket, data) {
  socket.to('lobby').emit('message', { text: data.text });
}
```

Spin up the server in `app.js`:

```javascript
import { SocketCraft } from 'socket-craft';

const app = new SocketCraft({ port: 5050 });
await app.listen();
```

---

## 📄 License

This project is licensed under the MIT License.

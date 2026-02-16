const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static frontend
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// In-memory room registry: roomId -> Set<socketId>
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', ({ roomId, displayName }) => {
    socket.data.roomId = roomId;
    socket.data.displayName = displayName || 'Guest';

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    const peers = rooms.get(roomId);
    peers.add(socket.id);

    // Inform the new client about existing peers
    const otherPeers = Array.from(peers).filter((id) => id !== socket.id);
    socket.emit('room-users', {
      users: otherPeers.map((id) => ({
        socketId: id,
        displayName: io.sockets.sockets.get(id)?.data.displayName || 'Guest'
      }))
    });

    // Notify others that a new user joined
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      displayName: socket.data.displayName
    });

    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // WebRTC signaling relays
  socket.on('webrtc-offer', ({ targetId, offer }) => {
    io.to(targetId).emit('webrtc-offer', {
      fromId: socket.id,
      offer,
      displayName: socket.data.displayName
    });
  });

  socket.on('webrtc-answer', ({ targetId, answer }) => {
    io.to(targetId).emit('webrtc-answer', {
      fromId: socket.id,
      answer
    });
  });

  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc-ice-candidate', {
      fromId: socket.id,
      candidate
    });
  });

  // Text chat messages
  socket.on('chat-message', ({ text }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const safeText = String(text || '').slice(0, 500);
    if (!safeText.trim()) return;

    const payload = {
      socketId: socket.id,
      displayName: socket.data.displayName || 'Guest',
      text: safeText,
      timestamp: Date.now()
    };

    io.to(roomId).emit('chat-message', payload);
  });

  // Presence: mute state updates
  socket.on('mute-state', ({ muted }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('mute-state', {
      socketId: socket.id,
      muted: !!muted
    });
  });

  socket.on('disconnect', () => {
    const { roomId } = socket.data;
    if (roomId && rooms.has(roomId)) {
      const peers = rooms.get(roomId);
      peers.delete(socket.id);
      if (peers.size === 0) {
        rooms.delete(roomId);
      }
      socket.to(roomId).emit('user-left', { socketId: socket.id });
    }
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`RTC FreeChat server listening on http://localhost:${PORT}`);
});


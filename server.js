const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static frontend
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// File uploads for chat attachments
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  }
});

app.use('/uploads', express.static(uploadsDir));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileInfo = {
    url: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname || 'file',
    mimeType: req.file.mimetype || 'application/octet-stream',
    size: req.file.size
  };

  res.json(fileInfo);
});

// Room and channel structure:
// rooms: Map<roomId, { channels: Map<channelId, { type: 'text'|'voice', users: Set<socketId> }>, users: Map<socketId, displayName> }>
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      channels: new Map(),
      users: new Map()
    });
    // Create default channels
    const room = rooms.get(roomId);
    room.channels.set('general', { type: 'text', users: new Set() });
    room.channels.set('voice-1', { type: 'voice', users: new Set() });
  }
  return rooms.get(roomId);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a room (like joining a server)
  socket.on('join-room', ({ roomId, displayName }) => {
    socket.data.roomId = roomId;
    socket.data.displayName = displayName || 'Guest';
    socket.data.currentChannel = null;

    const room = getOrCreateRoom(roomId);
    room.users.set(socket.id, socket.data.displayName);
    socket.join(roomId);

    // Send room info (channels and users)
    const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
      id,
      type: data.type,
      userCount: data.users.size
    }));

    const users = Array.from(room.users.entries()).map(([socketId, name]) => ({
      socketId,
      displayName: name
    }));

    socket.emit('room-info', { channels, users });
    socket.to(roomId).emit('user-joined-room', {
      socketId: socket.id,
      displayName: socket.data.displayName
    });

    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Create a new channel
  socket.on('create-channel', ({ channelName, channelType }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const channelId = channelName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (room.channels.has(channelId)) {
      socket.emit('channel-error', { message: 'Channel already exists' });
      return;
    }

    room.channels.set(channelId, {
      type: channelType || 'text',
      users: new Set()
    });

    const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
      id,
      type: data.type,
      userCount: data.users.size
    }));

    io.to(roomId).emit('channels-updated', { channels });
    console.log(`Channel ${channelId} created in room ${roomId}`);
  });

  // Join a channel
  socket.on('join-channel', ({ channelId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const channel = room.channels.get(channelId);
    if (!channel) return;

    // Leave previous channel
    if (socket.data.currentChannel) {
      const prevChannel = room.channels.get(socket.data.currentChannel);
      if (prevChannel) {
        prevChannel.users.delete(socket.id);
        socket.to(roomId).emit('user-left-channel', {
          socketId: socket.id,
          channelId: socket.data.currentChannel
        });
      }
    }

    // Join new channel
    socket.data.currentChannel = channelId;
    channel.users.add(socket.id);
    socket.join(`${roomId}:${channelId}`);

    // Get channel users
    const channelUsers = Array.from(channel.users)
      .map((socketId) => ({
        socketId,
        displayName: room.users.get(socketId) || 'Guest'
      }))
      .filter((u) => u.socketId !== socket.id);

    socket.emit('channel-users', {
      channelId,
      users: channelUsers
    });

    socket.to(`${roomId}:${channelId}`).emit('user-joined-channel', {
      socketId: socket.id,
      displayName: socket.data.displayName,
      channelId
    });

    // Update channel user counts
    const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
      id,
      type: data.type,
      userCount: data.users.size
    }));
    io.to(roomId).emit('channels-updated', { channels });

    console.log(`Socket ${socket.id} joined channel ${channelId} in room ${roomId}`);
  });

  // WebRTC signaling (scoped to voice channels)
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

  // Text chat messages (scoped to channels)
  socket.on('chat-message', ({ text, attachment }) => {
    const roomId = socket.data.roomId;
    const channelId = socket.data.currentChannel;
    if (!roomId || !channelId) return;

    const room = rooms.get(roomId);
    if (!room) return;
    const channel = room.channels.get(channelId);
    if (!channel || channel.type !== 'text') return;

    const safeText = String(text || '').slice(0, 500);
    const hasText = safeText.trim().length > 0;
    const hasAttachment = attachment && attachment.url;
    if (!hasText && !hasAttachment) return;

    const safeAttachment = hasAttachment
      ? {
          url: String(attachment.url),
          originalName: String(attachment.originalName || 'file').slice(0, 120),
          mimeType: String(attachment.mimeType || 'application/octet-stream'),
          size: Number(attachment.size || 0)
        }
      : undefined;

    const payload = {
      socketId: socket.id,
      displayName: socket.data.displayName || 'Guest',
      text: safeText,
      attachment: safeAttachment,
      channelId,
      timestamp: Date.now()
    };

    io.to(`${roomId}:${channelId}`).emit('chat-message', payload);
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
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users.delete(socket.id);

      // Leave channel
      if (socket.data.currentChannel) {
        const channel = room.channels.get(socket.data.currentChannel);
        if (channel) {
          channel.users.delete(socket.id);
          socket.to(roomId).emit('user-left-channel', {
            socketId: socket.id,
            channelId: socket.data.currentChannel
          });
        }
      }

      // Clean up empty room
      if (room.users.size === 0) {
        rooms.delete(roomId);
      } else {
        // Update channel user counts
        const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
          id,
          type: data.type,
          userCount: data.users.size
        }));
        io.to(roomId).emit('channels-updated', { channels });
      }

      socket.to(roomId).emit('user-left-room', { socketId: socket.id });
    }
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`RTC FreeChat server listening on http://localhost:${PORT}`);
});

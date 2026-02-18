import jwt from 'jsonwebtoken';
import { rooms, getOrCreateRoom } from '../state/rooms.js';
import {
  createChannel,
  saveMessage,
  getMessages,
  addReaction,
  removeReaction,
  getReactionsMap,
  getThreadMessages,
  getUserById,
} from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

/* eslint-disable no-console */
export default (io) => {
  // Middleware for Auth
  // Middleware for Auth
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.data.userId = decoded.id;
      socket.data.username = decoded.username;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, socket.data.username);

    // Join a room (like joining a server)
    socket.on('join-room', ({ roomId, displayName }) => {
      // Store user info
      socket.data.roomId = roomId;
      socket.data.displayName = displayName || socket.data.username; // Use auth username as fallback/primary
      socket.data.status = 'online'; // Default status
      socket.data.currentTextChannel = null;
      socket.data.currentVoiceChannel = null;

      const room = getOrCreateRoom(roomId);
      // Add to room (Presence)
      room.users.set(socket.id, {
        socketId: socket.id,
        userId: socket.data.userId, // Track userId
        displayName: socket.data.displayName,
        status: socket.data.status,
      });
      socket.join(roomId);

      // Send room info to client
      const channelsData = Array.from(room.channels.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        userCount: data.users.size,
      }));

      const usersData = Array.from(room.users.values());

      socket.emit('room-info', {
        channels: channelsData,
        users: usersData,
      });
      console.log('[Socket] Sent room-info to', socket.id, 'Channels:', channelsData.length);

      // Notify others
      socket.to(roomId).emit('user-joined-room', {
        socketId: socket.id,
        displayName: socket.data.displayName,
        status: socket.data.status,
      });

      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    // Status Change
    socket.on('status-change', ({ status }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !['online', 'idle', 'dnd', 'offline'].includes(status)) return;

      const room = rooms.get(roomId);
      if (!room) return;

      const user = room.users.get(socket.id);
      if (user) {
        user.status = status;
        socket.data.status = status;
        io.to(roomId).emit('user-status-update', {
          socketId: socket.id,
          status,
        });
      }
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

      // 1. Save to DB
      try {
        createChannel({
          id: channelId,
          name: channelName,
          type: channelType || 'text',
        });

        // 2. Update Memory
        room.channels.set(channelId, {
          type: channelType || 'text',
          users: new Set(),
        });

        // 3. Emit Update
        const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
          id,
          type: data.type,
          userCount: data.users.size,
        }));

        io.to(roomId).emit('channels-updated', { channels });
        console.log(`Channel ${channelId} created in room ${roomId}`);
      } catch (err) {
        console.error('Create channel error', err);
        socket.emit('channel-error', { message: 'Failed to create channel' });
      }
    });

    // Join a channel
    socket.on('join-channel', ({ channelId }) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room) return;

      if (!channelId) return;

      const channel = room.channels.get(channelId);
      if (!channel) return;

      // determine if joining text or voice
      const isVoice = channel.type === 'voice';
      const currentChannelId = isVoice
        ? socket.data.currentVoiceChannel
        : socket.data.currentTextChannel;

      // Leave previous channel of the same type
      if (currentChannelId) {
        if (currentChannelId === channelId) return; // Already in this channel

        const prevChannel = room.channels.get(currentChannelId);
        if (prevChannel) {
          prevChannel.users.delete(socket.id);
          socket.to(roomId).emit('user-left-channel', {
            socketId: socket.id,
            channelId: currentChannelId,
          });
          socket.leave(`${roomId}:${currentChannelId}`);
        }
      }

      // Join new channel
      if (isVoice) {
        socket.data.currentVoiceChannel = channelId;
      } else {
        socket.data.currentTextChannel = channelId;
      }

      channel.users.add(socket.id);
      socket.join(`${roomId}:${channelId}`);

      // Get channel users
      const channelUsers = Array.from(channel.users)
        .map((socketId) => ({
          socketId,
          displayName: room.users.get(socketId)?.displayName || 'Guest',
        }))
        .filter((u) => u.socketId !== socket.id);

      socket.emit('channel-users', {
        channelId,
        users: channelUsers,
      });

      socket.to(`${roomId}:${channelId}`).emit('user-joined-channel', {
        socketId: socket.id,
        displayName: socket.data.displayName,
        channelId,
      });

      // Send message history from DB
      if (!isVoice) {
        const messages = getMessages(channelId);
        // Enrich messages with reaction maps? 
        // Or client fetches reactions separately?
        // getMessages join users table.
        // We also need reactions.
        // For simplicity, let's fetch reactions for each message OR client fetches them?
        // Client expects reactions object on message.
        // Efficient way:
        messages.forEach(m => {
          m.reactions = getReactionsMap(m.id);
          m.replies = getThreadMessages(m.id); // Simple nested fetch, optimized later if slow
        });

        socket.emit('message-history', {
          channelId,
          messages,
        });
      }

      // Update channel user counts
      const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        userCount: data.users.size,
      }));
      io.to(roomId).emit('channels-updated', { channels });
    });

    // Leave a channel
    socket.on('leave-channel', ({ channelId }) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const channel = room.channels.get(channelId);
      if (!channel) return;

      channel.users.delete(socket.id);

      if (socket.data.currentTextChannel === channelId) {
        socket.data.currentTextChannel = null;
      } else if (socket.data.currentVoiceChannel === channelId) {
        socket.data.currentVoiceChannel = null;
      }

      socket.to(roomId).emit('user-left-channel', {
        socketId: socket.id,
        channelId,
      });
      socket.leave(`${roomId}:${channelId}`);

      const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        userCount: data.users.size,
      }));
      io.to(roomId).emit('channels-updated', { channels });
    });

    // Text chat messages
    socket.on('chat-message', ({ text, attachment }) => {
      const roomId = socket.data.roomId;
      const channelId = socket.data.currentTextChannel;
      if (!roomId || !channelId) return;

      const safeText = String(text || '').slice(0, 500);
      const hasText = safeText.trim().length > 0;
      const hasAttachment = attachment && attachment.url;
      if (!hasText && !hasAttachment) return;

      const safeAttachment = hasAttachment
        ? {
          url: String(attachment.url),
          originalName: String(attachment.originalName || 'file').slice(0, 120),
          mimeType: String(attachment.mimeType || 'application/octet-stream'),
          size: Number(attachment.size || 0),
        }
        : undefined;

      const userId = socket.data.userId;
      const messageId = Date.now().toString(36) + Math.random().toString(36).substr(2);

      const payload = {
        id: messageId,
        socketId: socket.id,
        userId: userId,
        displayName: socket.data.displayName || 'Guest',
        text: safeText,
        attachment: safeAttachment,
        channelId,
        timestamp: Date.now(),
        reactions: {},
        replies: [],
      };

      // 1. Save to DB
      try {
        saveMessage({
          id: messageId,
          channelId,
          userId,
          text: safeText,
          attachment: safeAttachment,
          timestamp: payload.timestamp,
        });

        // 2. Emit
        io.to(`${roomId}:${channelId}`).emit('chat-message', payload);
      } catch (err) {
        console.error('Save message error', err);
      }
    });

    // Thread Reply
    socket.on('send-reply', ({ channelId, parentId, text }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !channelId || !parentId || !text) return;

      const userId = socket.data.userId;
      const replyId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      const safeText = String(text).slice(0, 500);
      const timestamp = Date.now();

      try {
        saveMessage({
          id: replyId,
          channelId,
          userId,
          text: safeText,
          replyTo: parentId,
          timestamp,
        });

        // Broadcast to main thread listeners
        const replies = getThreadMessages(parentId);
        io.to(roomId).emit('thread-updated', {
          parentId,
          replies,
        });

        // Update reply count in main chat
        io.to(`${roomId}:${channelId}`).emit('message-updated', {
          id: parentId,
          replyCount: replies.length,
        });

      } catch (err) {
        console.error('Reply error', err);
      }
    });

    // Reactions
    socket.on('reaction-add', ({ channelId, messageId, emoji }) => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;
      if (!roomId || !messageId || !emoji) return;

      try {
        addReaction(messageId, userId, emoji);
        const reactions = getReactionsMap(messageId);
        io.to(`${roomId}:${channelId}`).emit('reaction-update', {
          messageId,
          reactions,
        });
      } catch (err) {
        console.error('Reaction add error', err);
      }
    });

    socket.on('reaction-remove', ({ channelId, messageId, emoji }) => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;
      if (!roomId || !messageId || !emoji) return;

      try {
        removeReaction(messageId, userId, emoji);
        const reactions = getReactionsMap(messageId);
        io.to(`${roomId}:${channelId}`).emit('reaction-update', {
          messageId,
          reactions,
        });
      } catch (err) {
        console.error('Reaction remove error', err);
      }
    });

    // Get Thread History (Explicit)
    socket.on('get-thread', ({ channelId, messageId }) => {
      const replies = getThreadMessages(messageId);
      socket.emit('thread-history', {
        parentId: messageId,
        replies,
      });
    });

    // Typing Indicators
    socket.on('typing', ({ channelId }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !channelId) return;
      socket.to(`${roomId}:${channelId}`).emit('user-typing', {
        socketId: socket.id,
        displayName: socket.data.displayName || 'Guest',
        channelId,
      });
    });

    socket.on('stop-typing', ({ channelId }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !channelId) return;
      socket.to(`${roomId}:${channelId}`).emit('user-stopped-typing', {
        socketId: socket.id,
        channelId,
      });
    });

    // Mute state
    socket.on('mute-state', ({ muted }) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('mute-state', {
        socketId: socket.id,
        muted: !!muted,
      });
    });

    // WebRTC
    socket.on('webrtc-offer', ({ targetId, offer }) => {
      io.to(targetId).emit('webrtc-offer', {
        fromId: socket.id,
        offer,
        displayName: socket.data.displayName,
      });
    });

    socket.on('webrtc-answer', ({ targetId, answer }) => {
      io.to(targetId).emit('webrtc-answer', {
        fromId: socket.id,
        answer,
      });
    });

    socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
      io.to(targetId).emit('webrtc-ice-candidate', {
        fromId: socket.id,
        candidate,
      });
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.users.delete(socket.id);

        const channelsToLeave = [socket.data.currentTextChannel, socket.data.currentVoiceChannel];
        channelsToLeave.forEach((channelId) => {
          if (channelId) {
            const channel = room.channels.get(channelId);
            if (channel) {
              channel.users.delete(socket.id);
              socket.to(roomId).emit('user-left-channel', {
                socketId: socket.id,
                channelId: channelId,
              });
            }
          }
        });

        if (room.users.size === 0) {
          // Keep room alive or delete? 
          // If we delete, we lose channel map in memory.
          // Since channels are in DB, we can delete in-memory room. 
          // getOrCreateRoom will check DB again.
          rooms.delete(roomId);
        } else {
          const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
            id,
            type: data.type,
            userCount: data.users.size,
          }));
          io.to(roomId).emit('channels-updated', { channels });
        }
        socket.to(roomId).emit('user-left-room', { socketId: socket.id });
      }
      console.log('Client disconnected:', socket.id);
    });
  });
};

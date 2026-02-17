const { rooms, getOrCreateRoom } = require('../state/rooms');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a room (like joining a server)
    socket.on('join-room', ({ roomId, displayName }) => {
      // Store user info
      socket.data.roomId = roomId;
      socket.data.displayName = displayName || 'Guest';
      socket.data.status = 'online'; // Default status
      socket.data.currentTextChannel = null;
      socket.data.currentVoiceChannel = null;

      const room = getOrCreateRoom(roomId);
      // Add to room
      room.users.set(socket.id, {
        socketId: socket.id,
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
        socket.data.status = status; // Update socket data as well
        // Broadcast update
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

      room.channels.set(channelId, {
        type: channelType || 'text',
        users: new Set(),
        messages: [],
      });

      const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        userCount: data.users.size,
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

      // If channelId is null, user wants to leave current channel(s)?
      // The client uses join-channel {channelId: null} to "leave".
      // But we have explicit leave-channel now.
      if (!channelId) return;

      const channel = room.channels.get(channelId);
      if (!channel) return;

      // determine if we are joining text or voice
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
          displayName: room.users.get(socketId) || 'Guest',
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

      // Send message history if text channel
      if (!isVoice && channel.messages) {
        socket.emit('message-history', {
          channelId,
          messages: channel.messages,
        });
      }

      // Update channel user counts
      const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        userCount: data.users.size,
      }));
      io.to(roomId).emit('channels-updated', { channels });

      console.log(
        `Socket ${socket.id} joined ${isVoice ? 'voice' : 'text'} channel ${channelId} in room ${roomId}`
      );
    });

    // Leave a channel
    socket.on('leave-channel', ({ channelId }) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room) return;

      const channel = room.channels.get(channelId);
      if (!channel) return;

      // Remove user from channel
      channel.users.delete(socket.id);

      // Update socket data
      if (socket.data.currentTextChannel === channelId) {
        socket.data.currentTextChannel = null;
      } else if (socket.data.currentVoiceChannel === channelId) {
        socket.data.currentVoiceChannel = null;
      }

      // Notify others
      socket.to(roomId).emit('user-left-channel', {
        socketId: socket.id,
        channelId,
      });
      socket.leave(`${roomId}:${channelId}`);

      // Update channel user counts
      const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        userCount: data.users.size,
      }));
      io.to(roomId).emit('channels-updated', { channels });

      console.log(`Socket ${socket.id} left channel ${channelId} in room ${roomId}`);
    });

    // WebRTC signaling (scoped to voice channels)
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

    // Text chat messages (scoped to channels)
    socket.on('chat-message', ({ text, attachment }) => {
      const roomId = socket.data.roomId;
      const channelId = socket.data.currentTextChannel;
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
            size: Number(attachment.size || 0),
          }
        : undefined;

      const messageId = Date.now().toString(36) + Math.random().toString(36).substr(2);

      const payload = {
        id: messageId,
        socketId: socket.id,
        displayName: socket.data.displayName || 'Guest',
        text: safeText,
        attachment: safeAttachment,
        channelId,
        timestamp: Date.now(),
        reactions: {}, // { '❤️': { count: 0, users: [] } }
        replies: [],
      };

      // Store message in history
      if (!channel.messages) channel.messages = [];
      channel.messages.push(payload);

      // Limit history to 50 messages
      if (channel.messages.length > 50) {
        channel.messages.shift();
      }

      io.to(`${roomId}:${channelId}`).emit('chat-message', payload);
    });

    // Thread Reply
    socket.on('send-reply', ({ channelId, parentId, text }) => {
      const roomId = socket.data.roomId;
      console.log('[Server] send-reply', { roomId, channelId, parentId, text });

      if (!roomId || !channelId || !parentId || !text) {
        console.error('[Server] Missing data for reply');
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        console.error('[Server] Room not found', roomId);
        return;
      }
      const channel = room.channels.get(channelId);
      if (!channel || !channel.messages) return;

      const parentMessage = channel.messages.find((m) => m.id === parentId);
      if (!parentMessage) {
        console.error('[Server] Parent message not found', parentId);
        return;
      }

      if (!parentMessage.replies) parentMessage.replies = [];

      const reply = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        parentId,
        socketId: socket.id,
        displayName: socket.data.displayName || 'Guest',
        text: String(text).slice(0, 500),
        timestamp: Date.now(),
      };

      parentMessage.replies.push(reply);

      // Broadcast thread update to anyone viewing the thread
      // io.to(roomId) should work if users are in the room.
      io.to(roomId).emit('thread-updated', {
        parentId,
        replies: parentMessage.replies,
      });

      // Update main chat to show reply count
      // Users in channel are in `${roomId}:${channelId}`
      io.to(`${roomId}:${channelId}`).emit('message-updated', {
        id: parentId,
        replyCount: parentMessage.replies.length,
      });
    });

    // Reactions
    socket.on('reaction-add', ({ channelId, messageId, emoji }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !channelId || !messageId || !emoji) return;

      const room = rooms.get(roomId);
      if (!room) return;
      const channel = room.channels.get(channelId);
      if (!channel || !channel.messages) return;

      const message = channel.messages.find((m) => m.id === messageId);
      if (!message) return;

      if (!message.reactions) message.reactions = {};
      if (!message.reactions[emoji]) message.reactions[emoji] = { count: 0, users: [] };

      // Check if user already reacted with this emoji
      if (!message.reactions[emoji].users.includes(socket.id)) {
        message.reactions[emoji].users.push(socket.id);
        message.reactions[emoji].count++;

        io.to(`${roomId}:${channelId}`).emit('reaction-update', {
          messageId,
          reactions: message.reactions,
        });
      }
    });

    socket.on('reaction-remove', ({ channelId, messageId, emoji }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !channelId || !messageId || !emoji) return;

      const room = rooms.get(roomId);
      if (!room) return;
      const channel = room.channels.get(channelId);
      if (!channel || !channel.messages) return;

      const message = channel.messages.find((m) => m.id === messageId);
      if (!message || !message.reactions || !message.reactions[emoji]) return;

      const userIndex = message.reactions[emoji].users.indexOf(socket.id);
      if (userIndex !== -1) {
        message.reactions[emoji].users.splice(userIndex, 1);
        message.reactions[emoji].count--;
        if (message.reactions[emoji].count <= 0) {
          delete message.reactions[emoji];
        }

        io.to(`${roomId}:${channelId}`).emit('reaction-update', {
          messageId,
          reactions: message.reactions,
        });
      }
    });

    // Presence: mute state updates
    socket.on('mute-state', ({ muted }) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('mute-state', {
        socketId: socket.id,
        muted: !!muted,
      });
    });

    // Get Thread History
    socket.on('get-thread', ({ channelId, messageId }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !channelId || !messageId) return;

      const room = rooms.get(roomId);
      if (!room) return;
      const channel = room.channels.get(channelId);
      if (!channel || !channel.messages) return;

      const message = channel.messages.find((m) => m.id === messageId);
      if (message) {
        socket.emit('thread-history', {
          parentId: messageId,
          replies: message.replies || [],
        });
      }
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

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.users.delete(socket.id);

        // Leave channels
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

        // Clean up empty room
        if (room.users.size === 0) {
          rooms.delete(roomId);
        } else {
          // Update channel user counts
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

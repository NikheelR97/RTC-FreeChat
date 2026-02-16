const { rooms, getOrCreateRoom } = require('../state/rooms');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Join a room (like joining a server)
        socket.on('join-room', ({ roomId, displayName }) => {
            socket.data.roomId = roomId;
            socket.data.displayName = displayName || 'Guest';
            socket.data.currentTextChannel = null;
            socket.data.currentVoiceChannel = null;

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
                users: new Set(),
                messages: []
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

            // If channelId is null, user wants to leave current channel(s)? 
            // The client uses join-channel {channelId: null} to "leave".
            // But we have explicit leave-channel now.
            if (!channelId) return;

            const channel = room.channels.get(channelId);
            if (!channel) return;

            // determine if we are joining text or voice
            const isVoice = channel.type === 'voice';
            const currentChannelId = isVoice ? socket.data.currentVoiceChannel : socket.data.currentTextChannel;

            // Leave previous channel of the same type
            if (currentChannelId) {
                if (currentChannelId === channelId) return; // Already in this channel

                const prevChannel = room.channels.get(currentChannelId);
                if (prevChannel) {
                    prevChannel.users.delete(socket.id);
                    socket.to(roomId).emit('user-left-channel', {
                        socketId: socket.id,
                        channelId: currentChannelId
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

            // Send message history if text channel
            if (!isVoice && channel.messages) {
                socket.emit('message-history', {
                    channelId,
                    messages: channel.messages
                });
            }

            // Update channel user counts
            const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
                id,
                type: data.type,
                userCount: data.users.size
            }));
            io.to(roomId).emit('channels-updated', { channels });

            console.log(`Socket ${socket.id} joined ${isVoice ? 'voice' : 'text'} channel ${channelId} in room ${roomId}`);
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
                channelId
            });
            socket.leave(`${roomId}:${channelId}`);

            // Update channel user counts
            const channels = Array.from(room.channels.entries()).map(([id, data]) => ({
                id,
                type: data.type,
                userCount: data.users.size
            }));
            io.to(roomId).emit('channels-updated', { channels });

            console.log(`Socket ${socket.id} left channel ${channelId} in room ${roomId}`);
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

            // Store message in history
            if (!channel.messages) channel.messages = [];
            channel.messages.push(payload);

            // Limit history to 50 messages
            if (channel.messages.length > 50) {
                channel.messages.shift();
            }

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

                // Leave channels
                const channelsToLeave = [socket.data.currentTextChannel, socket.data.currentVoiceChannel];

                channelsToLeave.forEach(channelId => {
                    if (channelId) {
                        const channel = room.channels.get(channelId);
                        if (channel) {
                            channel.users.delete(socket.id);
                            socket.to(roomId).emit('user-left-channel', {
                                socketId: socket.id,
                                channelId: channelId
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
                        userCount: data.users.size
                    }));
                    io.to(roomId).emit('channels-updated', { channels });
                }

                socket.to(roomId).emit('user-left-room', { socketId: socket.id });
            }
            console.log('Client disconnected:', socket.id);
        });
    });
};

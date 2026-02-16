import { state } from './state.js';
import { updateChannelList, updateMembersList, updateVoicePanel, appendChatMessage, setStatus, showTyping, hideTyping } from './ui.js';
import { createPeerConnection, cleanupPeer, ensureLocalStream } from './webrtc.js';
import { sounds } from './sounds.js';
// import { switchChannel } from './main.js'; // Removed to avoid cycle
// Better to pass switchChannel as callback or emit event.
// For now, let's export a setup function that takes callbacks if needed.
// Actually, circular dependency in ES modules is okay if handled correctly, but cleaner to avoid.
// Let's implement switchChannel logic in main.js and update UI from here.

export function setupSocket(socket) {
    // Remove existing listeners to prevent duplicates if setup is called multiple times
    socket.off('connect');
    socket.off('room-info');
    socket.off('channels-updated');
    socket.off('channel-users');
    socket.off('user-joined-room');
    socket.off('user-left-room');
    socket.off('user-joined-channel');
    socket.off('user-left-channel');
    socket.off('webrtc-offer');
    socket.off('webrtc-answer');
    socket.off('webrtc-ice-candidate');
    socket.off('message-history');
    socket.off('user-typing');
    socket.off('user-stopped-typing');
    socket.off('chat-message');
    socket.off('mute-state');

    socket.off('mute-state');

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('room-info', ({ channels: channelsData, users: usersData }) => {
        state.channels.clear();
        channelsData.forEach((ch) => {
            state.channels.set(ch.id, { type: ch.type, userCount: ch.userCount });
        });
        updateChannelList(window.switchChannel); // We'll attach switchChannel to window or pass it

        state.roomUsers.clear();
        usersData.forEach((u) => {
            state.roomUsers.set(u.socketId, { displayName: u.displayName });
        });
        updateMembersList();

        // Auto-join first text channel if available
        const firstTextChannel = Array.from(state.channels.entries()).find(
            ([, ch]) => ch.type === 'text'
        );
        if (firstTextChannel && !state.currentTextChannelId) {
            if (window.switchChannel) window.switchChannel(firstTextChannel[0]);
        }
    });

    socket.on('channels-updated', ({ channels: channelsData }) => {
        state.channels.clear();
        channelsData.forEach((ch) => {
            state.channels.set(ch.id, { type: ch.type, userCount: ch.userCount });
        });
        updateChannelList(window.switchChannel);
    });

    socket.on('channel-users', ({ channelId, users }) => {
        if (channelId === state.currentVoiceChannelId) {
            state.remoteParticipants.clear();
            users.forEach((user) => {
                state.remoteParticipants.set(user.socketId, {
                    displayName: user.displayName,
                    muted: false
                });
            });
            updateVoicePanel();

            users.forEach((user) => {
                if (user.socketId !== state.socket.id) {
                    createPeerConnection(user.socketId, user.displayName, true);
                }
            });
        }
    });

    socket.on('user-joined-room', ({ socketId, displayName }) => {
        state.roomUsers.set(socketId, { displayName });
        updateMembersList();
    });

    socket.on('user-left-room', ({ socketId }) => {
        state.roomUsers.delete(socketId);
        cleanupPeer(socketId);
        updateMembersList();
    });

    socket.on('user-joined-channel', ({ socketId, displayName, channelId }) => {
        if (channelId === state.currentVoiceChannelId) {
            state.remoteParticipants.set(socketId, { displayName, muted: false });
            updateVoicePanel();
            sounds.join();
        }
    });

    socket.on('user-left-channel', ({ socketId, channelId }) => {
        if (channelId === state.currentVoiceChannelId) {
            cleanupPeer(socketId);
            sounds.leave();
        }
    });

    // ... webrtc handlers ...

    socket.on('chat-message', (payload) => {
        const { socketId, displayName, text, timestamp, attachment, channelId } = payload || {};
        if (channelId === state.currentTextChannelId) {
            appendChatMessage({ socketId, displayName, text, timestamp, attachment });
            if (socketId !== state.socket.id) {
                sounds.message();
            }
        }
    });

    socket.on('webrtc-offer', async ({ fromId, offer, displayName }) => {
        if (!state.currentVoiceChannelId) return;
        try {
            await ensureLocalStream();
            if (!state.remoteParticipants.has(fromId)) {
                state.remoteParticipants.set(fromId, { displayName: displayName || 'Guest', muted: false });
            }
            const pc = createPeerConnection(fromId, displayName, false);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-answer', {
                targetId: fromId,
                answer
            });
            updateVoicePanel();
        } catch (err) {
            console.error('Error handling offer:', err);
        }
    });

    socket.on('webrtc-answer', async ({ fromId, answer }) => {
        const pc = state.peerConnections.get(fromId);
        if (!pc) return;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
            console.error('Error setting remote answer:', err);
        }
    });

    socket.on('webrtc-ice-candidate', async ({ fromId, candidate }) => {
        const pc = state.peerConnections.get(fromId);
        if (!pc) return;
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.error('Error adding ICE candidate:', err);
        }
    });

    socket.on('message-history', ({ channelId, messages }) => {
        if (channelId === state.currentTextChannelId) {
            messages.forEach(msg => {
                appendChatMessage(msg);
            });
            // Scroll to bottom
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });

    socket.on('user-typing', ({ socketId, displayName, channelId }) => {
        if (channelId === state.currentTextChannelId && socketId !== state.socket.id) {
            showTyping(displayName);
        }
    });

    socket.on('user-stopped-typing', ({ socketId, displayName, channelId }) => {
        // Note: server only sent socketId in stop-typing, but we need displayName for set?
        // Actually our set uses displayName purely.
        // Wait, ShowTyping uses displayName. HideTyping uses displayName.
        // The server event 'user-stopped-typing' only sends socketId.
        // We need to look up displayName from state.roomUsers?
        if (channelId === state.currentTextChannelId) {
            const user = state.roomUsers.get(socketId);
            if (user) hideTyping(user.displayName);
        }
    });



    socket.on('mute-state', ({ socketId, muted }) => {
        const info = state.remoteParticipants.get(socketId);
        if (info) {
            info.muted = !!muted;
            updateVoicePanel();
        }
    });
}

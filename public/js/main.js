import { state, setSocket, setLocalStream } from './state.js';
import { elements, updateChannelList, updateMembersList, updateVoicePanel, openMobileSidebar, closeMobileSidebars, setStatus } from './ui.js';
import { escapeHtml, getInitials, compressImageFile } from './utils.js';
import { ensureLocalStream, joinVoiceChannel, leaveVoiceChannel, cleanupAllPeers } from './webrtc.js';
import { setupSocket } from './socket-client.js';
import { setupEmojiPicker } from './emoji.js';
import { setupGifPicker } from './gif.js';

// Setup Pickers
setupEmojiPicker();
setupGifPicker();

// Expose switchChannel to window for UI callbacks (avoid cyclic dependency issues in simple setup)
window.switchChannel = switchChannel;

// DOM Event Listeners
if (elements.joinForm) {
    elements.joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.socket) return; // Prevent multiple connections

        const displayName = elements.displayNameInput.value.trim();
        if (!displayName) return;

        // Disable button to prevent double clicks
        const btn = elements.joinForm.querySelector('button');
        if (btn) btn.disabled = true;

        state.currentDisplayName = displayName;
        elements.userName.textContent = displayName;
        elements.userAvatar.textContent = getInitials(displayName);

        // Connect socket
        const socket = io();
        setSocket(socket);
        setupSocket(socket);

        // Join default room 'main'
        state.currentRoomId = 'main';
        socket.emit('join-room', { roomId: state.currentRoomId, displayName });

        elements.joinScreen.classList.add('hidden');
        elements.app.classList.remove('hidden');
    });
}

// Channel creation
if (elements.createChannelBtn) {
    elements.createChannelBtn.addEventListener('click', () => {
        elements.createChannelModal.classList.remove('hidden');
    });
}

if (elements.cancelChannelBtn) {
    elements.cancelChannelBtn.addEventListener('click', () => {
        elements.createChannelModal.classList.add('hidden');
        elements.createChannelForm.reset();
    });
}

if (elements.createChannelForm) {
    elements.createChannelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const channelName = elements.channelNameInput.value.trim();
        const channelType = elements.channelTypeSelect.value;
        if (!channelName || !state.socket) return;

        state.socket.emit('create-channel', { channelName, channelType });
        elements.createChannelModal.classList.add('hidden');
        elements.createChannelForm.reset();
    });
}

// Mobile sidebars
if (elements.mobileMenuButton && elements.sidebarLeft) {
    elements.mobileMenuButton.addEventListener('click', () => {
        openMobileSidebar(elements.sidebarLeft);
    });
}

if (elements.mobileMembersButton && elements.sidebarRight) {
    elements.mobileMembersButton.addEventListener('click', () => {
        openMobileSidebar(elements.sidebarRight);
    });
}

// Voice controls
if (elements.voiceDisconnectBtn) {
    elements.voiceDisconnectBtn.addEventListener('click', () => {
        leaveVoiceChannel();
        if (state.socket) {
            state.socket.emit('leave-channel', { channelId: state.currentVoiceChannelId });
        }

        state.currentVoiceChannelId = null;
        elements.voicePanel.classList.add('hidden');
        cleanupAllPeers();
        if (state.localStream) {
            state.localStream.getTracks().forEach((t) => (t.enabled = true));
        }
        state.isMuted = false;
        state.remoteParticipants.clear();
    });
}

if (elements.muteButton) {
    elements.muteButton.addEventListener('click', toggleMute);
}

if (elements.pttCheckbox) {
    elements.pttCheckbox.addEventListener('change', () => {
        state.isPushToTalkEnabled = elements.pttCheckbox.checked;
        if (state.isPushToTalkEnabled) {
            if (state.localStream) {
                setMuted(true);
            }
        } else {
            state.isPushToTalkKeyDown = false;
        }
    });
}

// Global Key Listeners for PTT
window.addEventListener('keydown', (event) => {
    if (!state.isPushToTalkEnabled || !state.localStream || !state.currentVoiceChannelId) return;
    if (event.code === 'Space' && !state.isPushToTalkKeyDown) {
        event.preventDefault();
        state.isPushToTalkKeyDown = true;
        setMuted(false);
    }
});

window.addEventListener('keyup', (event) => {
    if (!state.isPushToTalkEnabled || !state.localStream || !state.currentVoiceChannelId) return;
    if (event.code === 'Space') {
        event.preventDefault();
        state.isPushToTalkKeyDown = false;
        setMuted(true);
    }
});

function setMuted(muted) {
    state.isMuted = !!muted;
    if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
            track.enabled = !state.isMuted;
        });
    }
    if (elements.muteButton) {
        elements.muteButton.textContent = state.isMuted ? '🔇' : '🔊';
        elements.muteButton.title = state.isMuted ? 'Unmute' : 'Mute';
    }

    if (state.socket && state.socket.connected) {
        state.socket.emit('mute-state', { muted: state.isMuted });
    }
    updateVoicePanel(); // To update self status if we showed it
}

function toggleMute() {
    if (!state.localStream || state.isPushToTalkEnabled) return;
    setMuted(!state.isMuted);
}

// Chat Form
if (elements.chatForm) {
    elements.chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.socket || !state.socket.connected || !state.currentTextChannelId) return;

        const text = elements.chatInput.value.trim();
        const file = elements.chatFileInput && elements.chatFileInput.files[0];
        let attachment = null;

        if (file) {
            let uploadFile = file;
            if (
                file.type &&
                file.type.startsWith('image/') &&
                elements.compressImagesCheckbox &&
                elements.compressImagesCheckbox.checked
            ) {
                try {
                    const compressed = await compressImageFile(file, 960, 0.7);
                    if (compressed) {
                        uploadFile = compressed;
                    }
                } catch (err) {
                    console.warn('Image compression failed', err);
                }
            }

            const formData = new FormData();
            formData.append('file', uploadFile);
            try {
                const res = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    attachment = await res.json();
                }
            } catch (err) {
                console.error('Upload error', err);
            }
        }

        if (!text && !attachment) return;

        state.socket.emit('chat-message', { text, attachment });
        state.socket.emit('stop-typing', { channelId: state.currentTextChannelId });
        elements.chatInput.value = '';
        if (elements.chatFileInput) elements.chatFileInput.value = '';
        if (elements.chatFileName) elements.chatFileName.textContent = '';
    });

    // Typing emission
    let typingTimeout = null;
    elements.chatInput.addEventListener('input', () => {
        if (!state.socket || !state.currentTextChannelId) return;

        state.socket.emit('typing', { channelId: state.currentTextChannelId });

        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            state.socket.emit('stop-typing', { channelId: state.currentTextChannelId });
        }, 3000);
    });

    // Theme Toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        });

        // Init theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        }
    }
}

// File buttons
if (elements.fileButton && elements.chatFileInput) {
    elements.fileButton.addEventListener('click', () => {
        elements.chatFileInput.click();
    });

    elements.chatFileInput.addEventListener('change', () => {
        const file = elements.chatFileInput.files[0];
        if (file) {
            if (elements.chatFileName) elements.chatFileName.textContent = `Attachment: ${file.name}`;
        } else {
            if (elements.chatFileName) elements.chatFileName.textContent = '';
        }
    });
}


// Listen for custom GIF send event
document.addEventListener('send-gif', (e) => {
    if (!state.socket || !state.currentTextChannelId) return;
    const { url, originalName, mimeType, size } = e.detail;

    // Send as attachment
    state.socket.emit('chat-message', {
        text: '',
        attachment: { url, originalName, mimeType, size }
    });
});

// Exported for UI to use
export function switchChannel(channelId) {
    if (!state.socket) return;

    const channel = state.channels.get(channelId);
    if (!channel) return;

    if (channel.type === 'voice') {
        // Join Voice
        if (state.currentVoiceChannelId === channelId) return; // Already in this voice channel

        // Leave previous voice if any (handled by server, but we update UI)
        if (state.currentVoiceChannelId && state.currentVoiceChannelId !== channelId) {
            leaveVoiceChannel();
        }

        state.currentVoiceChannelId = channelId;
        state.socket.emit('join-channel', { channelId });

        // Update Voice UI
        elements.voicePanel.classList.remove('hidden');
        if (elements.voiceChannelName) elements.voiceChannelName.textContent = escapeHtml(channelId);

        if (state.localStream) {
            joinVoiceChannel();
        } else {
            ensureLocalStream().then(() => joinVoiceChannel());
        }
    } else {
        // Join Text
        if (state.currentTextChannelId === channelId) return;

        state.currentTextChannelId = channelId;
        state.socket.emit('join-channel', { channelId });

        // Update Text UI
        updateChannelList(window.switchChannel);
        if (elements.currentChannelName) elements.currentChannelName.textContent = escapeHtml(channelId);
        if (elements.currentChannelIcon) elements.currentChannelIcon.textContent = '#';

        elements.messagesArea.classList.remove('hidden');
        elements.chatMessages.innerHTML = '';
    }
}

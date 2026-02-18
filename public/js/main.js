import { state, setSocket } from './state.js';
import {
  elements,
  updateChannelList,
  updateVoicePanel,
  createStatusPicker,
  currentThreadId,
  closeThread,
  toggleMembers,
} from './ui.js';
import { escapeHtml, getInitials, compressImageFile } from './utils.js';
import {
  ensureLocalStream,
  joinVoiceChannel,
  leaveVoiceChannel,
  cleanupAllPeers,
} from './webrtc.js';

import { setupSocket } from './socket-client.js';

import { setupEmojiPicker } from './emoji.js';
import { setupGifPicker } from './gif.js';
import { setupCommandPalette } from './command-palette.js';
import { setupDragDrop } from './drag-drop.js';

import { setupGestures } from './gestures.js';

// Auth Check
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html';
} else {
  // Verify token with server
  fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error('Invalid token');
      return res.json();
    })
    .then((data) => {
      state.currentUser = data.user;
      state.currentDisplayName = data.user.username;

      // Update UI with user info
      if (elements.currentUserName) elements.currentUserName.textContent = state.currentDisplayName;
      if (elements.currentUserAvatar)
        elements.currentUserAvatar.textContent = getInitials(state.currentDisplayName);

      // Hide Join Screen / Show App
      if (elements.joinScreen) elements.joinScreen.classList.add('hidden');
      if (elements.app) elements.app.classList.remove('hidden');

      // Auto-connect socket
      initSocket();
    })
    .catch(() => {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    });
}

function initSocket() {
  const socket = io({
    auth: { token },
  });
  setSocket(socket);
  setupSocket(socket);

  // Join default room
  state.currentRoomId = 'main';
  socket.emit('join-room', { roomId: state.currentRoomId, displayName: state.currentDisplayName });
}

// Setup Pickers
setupEmojiPicker();
setupGifPicker();
setupGestures();
setupDragDrop(handleFileSelect);
createStatusPicker();

// Import AFTER switchChannel is defined/exported or just pass it?
// We need to wait for switchChannel to be defined if we pass it?
// switchChannel is a function declaration below, so it is hoisted.
setupCommandPalette(switchChannel);

// Expose switchChannel to window for UI callbacks (avoid cyclic dependency issues in simple setup)
window.switchChannel = switchChannel;

if (elements.logoutBtn) {
  elements.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  });
}

let pendingAttachment = null;

function handleFileSelect(file) {
  if (!file) return;
  pendingAttachment = file;

  // Show Preview
  if (elements.filePreviewArea) {
    elements.filePreviewArea.classList.remove('hidden');
    elements.previewFilename.textContent = file.name;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        elements.previewImage.src = e.target.result;
        elements.previewImage.classList.remove('hidden');
        elements.previewFileIcon.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    } else {
      elements.previewImage.classList.add('hidden');
      elements.previewFileIcon.classList.remove('hidden');
    }
  }
}

// Thread Handling
if (elements.threadForm) {
  elements.threadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = elements.threadInput.value;
    if (!text.trim() || !currentThreadId) return;

    state.socket.emit('send-reply', {
      channelId: state.currentTextChannelId,
      parentId: currentThreadId,
      text,
    });

    elements.threadInput.value = '';
  });
}

if (elements.closeThreadBtn) {
  elements.closeThreadBtn.addEventListener('click', () => {
    closeThread();
  });
}

// Double click to heart
if (elements.chatMessages) {
  elements.chatMessages.addEventListener('dblclick', (e) => {
    const messageDiv = e.target.closest('.chat-message');
    if (messageDiv && messageDiv.id && messageDiv.id.startsWith('msg-')) {
      // Prevent reacting to own message
      if (messageDiv.classList.contains('own-message')) return;

      const messageId = messageDiv.id.replace('msg-', '');
      // Default heart reaction
      state.socket.emit('reaction-add', {
        channelId: state.currentTextChannelId,
        messageId: messageId,
        emoji: '❤️',
      });

      // Visual feedback?
      // createFloatingHeart(e.clientX, e.clientY);
    }
  });
}

function clearAttachment() {
  pendingAttachment = null;
  if (elements.filePreviewArea) {
    elements.filePreviewArea.classList.add('hidden');
    elements.previewImage.src = '';
  }
  if (elements.chatFileInput) elements.chatFileInput.value = '';
}

if (elements.removeFileBtn) {
  elements.removeFileBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submit if inside form
    clearAttachment();
  });
}

// Join Form (Legacy - Removed for Auth Phase)
if (elements.joinForm) {
  elements.joinForm.classList.add('hidden'); // Hide if present
  elements.app.classList.remove('hidden'); // Show app immediately
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

// Drawer Toggles (Mobile & Desktop triggers)
// Note: Gestures also handle this, but buttons are good for accessibility/desktop
if (elements.menuButton && elements.drawerLeft) {
  elements.menuButton.addEventListener('click', () => {
    // Toggle class on body or use openMobileSidebar export
    // openMobileSidebar(elements.drawerLeft);
    // Using body class directly to match gestures.js style
    document.body.classList.toggle('drawer-open-left');
  });
}

if (elements.membersButton) {
  elements.membersButton.addEventListener('click', () => {
    toggleMembers();
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

if (elements.cameraButton) {
  elements.cameraButton.addEventListener('click', async () => {
    const webrtc = await import('./webrtc.js');
    const isEnabled = await webrtc.toggleVideo();
    elements.cameraButton.style.background = isEnabled ? 'var(--accent)' : 'transparent';
    elements.cameraButton.style.color = isEnabled ? '#fff' : 'var(--text-main)';
  });
}

if (elements.screenShareButton) {
  elements.screenShareButton.addEventListener('click', async () => {
    const webrtc = await import('./webrtc.js');
    if (state.isScreenSharing) {
      webrtc.stopScreenShare();
      elements.screenShareButton.style.background = 'transparent';
      elements.screenShareButton.style.color = 'var(--text-main)';
    } else {
      const success = await webrtc.startScreenShare();
      if (success) {
        elements.screenShareButton.style.background = 'var(--danger)';
        elements.screenShareButton.style.color = '#fff';
      }
    }
  });
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
    if (!state.socket || !state.socket.connected || !state.currentTextChannelId) {
      console.warn('Cannot send message: validation failed');
      return;
    }

    const text = elements.chatInput.value.trim();
    // Check for pending attachment from DragDrop OR File Input
    // (FileInput change listener should update pendingAttachment actually)

    let fileToUpload = pendingAttachment;

    if (!fileToUpload && elements.chatFileInput && elements.chatFileInput.files[0]) {
      fileToUpload = elements.chatFileInput.files[0];
    }

    let attachment = null;

    if (fileToUpload) {
      let uploadFile = fileToUpload;
      if (
        fileToUpload.type &&
        fileToUpload.type.startsWith('image/') &&
        elements.compressImagesCheckbox && // Checkbox might be missing in new UI, handle gracefully
        elements.compressImagesCheckbox.checked
      ) {
        try {
          const compressed = await compressImageFile(fileToUpload, 960, 0.7);
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
        // Show uploading state?
        const res = await fetch('/upload', {
          method: 'POST',
          body: formData,
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
    clearAttachment();
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
      handleFileSelect(file);
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
    attachment: { url, originalName, mimeType, size },
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
    if (elements.currentChannelName)
      elements.currentChannelName.textContent = escapeHtml(channelId);
    if (elements.currentChannelIcon) elements.currentChannelIcon.textContent = '#';

    elements.messagesArea.classList.remove('hidden');
    elements.chatMessages.innerHTML = '';
  }
}

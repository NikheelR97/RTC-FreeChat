// Discord-like VoIP app with channels

// DOM Elements
const joinScreen = document.getElementById('join-screen');
const app = document.getElementById('app');
const joinForm = document.getElementById('join-form');
const displayNameInput = document.getElementById('display-name-input');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');
const textChannelsList = document.getElementById('text-channels-list');
const voiceChannelsList = document.getElementById('voice-channels-list');
const createChannelBtn = document.getElementById('create-channel-btn');
const createChannelModal = document.getElementById('create-channel-modal');
const createChannelForm = document.getElementById('create-channel-form');
const cancelChannelBtn = document.getElementById('cancel-channel-btn');
const channelNameInput = document.getElementById('channel-name-input');
const channelTypeSelect = document.getElementById('channel-type-select');
const currentChannelName = document.getElementById('current-channel-name');
const currentChannelIcon = document.getElementById('current-channel-icon');
const messagesArea = document.getElementById('messages-area');
const voiceArea = document.getElementById('voice-area');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatFileInput = document.getElementById('chat-file-input');
const chatFileName = document.getElementById('chat-file-name');
const fileButton = document.getElementById('file-button');
const emojiButton = document.getElementById('emoji-button');
const emojiPicker = document.getElementById('emoji-picker');
const emojiPickerContent = document.getElementById('emoji-picker-content');
const emojiPickerTabs = document.getElementById('emoji-picker-tabs');
const emojiSearchInput = document.getElementById('emoji-search-input');
const compressImagesCheckbox = document.getElementById('compress-images-checkbox');
const muteButton = document.getElementById('mute-button');
const leaveButton = document.getElementById('leave-button');
const membersList = document.getElementById('members-list');
const memberCount = document.getElementById('member-count');
const voiceParticipants = document.getElementById('voice-participants');
const statusText = document.getElementById('status-text');
const pttCheckbox = document.getElementById('ptt-checkbox');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMembersButton = document.getElementById('mobile-members-button');
const sidebarLeft = document.querySelector('.sidebar-left');
const sidebarRight = document.querySelector('.sidebar-right');

// State
let socket = null;
let localStream = null;
let currentRoomId = null;
let currentDisplayName = null;
let currentChannelId = null;
let currentChannelType = null;
let isMuted = false;
let isPushToTalkEnabled = false;
let isPushToTalkKeyDown = false;

// Channel and user data
const channels = new Map(); // channelId -> { type, userCount }
const roomUsers = new Map(); // socketId -> { displayName }
const remoteParticipants = new Map(); // socketId -> { displayName, muted }

// WebRTC
const peerConnections = new Map();
const peerAudioElements = new Map();

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Join room
joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const displayName = displayNameInput.value.trim();
  if (!displayName) return;

  currentDisplayName = displayName;
  userName.textContent = displayName;
  userAvatar.textContent = getInitials(displayName);

  socket = io();
  wireSocketEvents();

  // Use a default room ID (could be made configurable)
  currentRoomId = 'main';
  socket.emit('join-room', { roomId: currentRoomId, displayName });

  joinScreen.classList.add('hidden');
  app.classList.remove('hidden');
});

// Create channel
createChannelBtn.addEventListener('click', () => {
  createChannelModal.classList.remove('hidden');
});

cancelChannelBtn.addEventListener('click', () => {
  createChannelModal.classList.add('hidden');
  createChannelForm.reset();
});

createChannelForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const channelName = channelNameInput.value.trim();
  const channelType = channelTypeSelect.value;
  if (!channelName || !socket) return;

  socket.emit('create-channel', { channelName, channelType });
  createChannelModal.classList.add('hidden');
  createChannelForm.reset();
});

// Mobile menu functionality
let sidebarOverlay = null;

function createSidebarOverlay() {
  if (sidebarOverlay) return sidebarOverlay;
  sidebarOverlay = document.createElement('div');
  sidebarOverlay.className = 'sidebar-overlay';
  sidebarOverlay.addEventListener('click', closeMobileSidebars);
  document.body.appendChild(sidebarOverlay);
  return sidebarOverlay;
}

function openMobileSidebar(sidebar) {
  const overlay = createSidebarOverlay();
  sidebar.classList.add('mobile-open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebars() {
  if (sidebarLeft) sidebarLeft.classList.remove('mobile-open');
  if (sidebarRight) sidebarRight.classList.remove('mobile-open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

if (mobileMenuButton && sidebarLeft) {
  mobileMenuButton.addEventListener('click', () => {
    openMobileSidebar(sidebarLeft);
  });
}

if (mobileMembersButton && sidebarRight) {
  mobileMembersButton.addEventListener('click', () => {
    openMobileSidebar(sidebarRight);
  });
}

// Channel switching
function switchChannel(channelId) {
  if (!socket || channelId === currentChannelId) return;

  // Leave voice if in voice channel
  if (currentChannelType === 'voice') {
    leaveVoiceChannel();
  }

  currentChannelId = channelId;
  const channel = channels.get(channelId);
  if (!channel) return;

  currentChannelType = channel.type;
  socket.emit('join-channel', { channelId });

  // Update UI
  updateChannelList();
  currentChannelName.textContent = channelId;
  currentChannelIcon.textContent = channel.type === 'text' ? '#' : '🔊';

  // Show appropriate area
  if (channel.type === 'text') {
    messagesArea.classList.remove('hidden');
    voiceArea.classList.add('hidden');
    chatMessages.innerHTML = '';
  } else {
    messagesArea.classList.add('hidden');
    voiceArea.classList.remove('hidden');
    if (localStream) {
      joinVoiceChannel();
    } else {
      ensureLocalStream().then(() => joinVoiceChannel());
    }
  }
}

function updateChannelList() {
  // Text channels
  textChannelsList.innerHTML = '';
  // Voice channels
  voiceChannelsList.innerHTML = '';

  channels.forEach((channel, channelId) => {
    const li = document.createElement('li');
    li.className = `channel-item ${channelId === currentChannelId ? 'active' : ''}`;
    li.innerHTML = `
      <span class="channel-icon">${channel.type === 'text' ? '#' : '🔊'}</span>
      <span>${escapeHtml(channelId)}</span>
      ${channel.userCount > 0 ? `<span style="margin-left: auto; font-size: 12px;">${channel.userCount}</span>` : ''}
    `;
    li.addEventListener('click', () => {
      switchChannel(channelId);
      // Close sidebar on mobile after selecting channel
      if (window.innerWidth <= 768) {
        closeMobileSidebars();
      }
    });

    if (channel.type === 'text') {
      textChannelsList.appendChild(li);
    } else {
      voiceChannelsList.appendChild(li);
    }
  });
}

function updateMembersList() {
  membersList.innerHTML = '';
  let count = 0;

  roomUsers.forEach((user, socketId) => {
    count++;
    const li = document.createElement('div');
    li.className = 'member-item';
    const initials = getInitials(user.displayName);
    li.innerHTML = `
      <div class="member-avatar">${initials}</div>
      <div class="member-name">${escapeHtml(user.displayName)}</div>
      <div class="member-status"></div>
    `;
    membersList.appendChild(li);
  });

  memberCount.textContent = count;
}

function updateVoiceParticipants() {
  voiceParticipants.innerHTML = '';

  // Add local user
  if (currentDisplayName) {
    const div = document.createElement('div');
    div.className = 'voice-participant';
    div.innerHTML = `
      <div class="voice-participant-avatar">${getInitials(currentDisplayName)}</div>
      <div class="voice-participant-name">${escapeHtml(currentDisplayName)}</div>
      <div class="voice-participant-status">${isMuted ? 'Muted' : 'Speaking'}</div>
    `;
    voiceParticipants.appendChild(div);
  }

  // Add remote participants in this voice channel
  remoteParticipants.forEach((info, socketId) => {
    const div = document.createElement('div');
    div.className = 'voice-participant';
    div.innerHTML = `
      <div class="voice-participant-avatar">${getInitials(info.displayName || 'Guest')}</div>
      <div class="voice-participant-name">${escapeHtml(info.displayName || 'Guest')}</div>
      <div class="voice-participant-status">${info.muted ? 'Muted' : 'Speaking'}</div>
    `;
    voiceParticipants.appendChild(div);
  });
}

// Chat messages
function appendChatMessage({ socketId, displayName, text, timestamp, attachment }) {
  if (!chatMessages) return;
  const atBottom =
    chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 10;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';

  const time = timestamp ? new Date(timestamp) : new Date();
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let attachmentHtml = '';
  if (attachment && attachment.url) {
    const safeUrl = attachment.url;
    const safeName = escapeHtml(attachment.originalName || 'attachment');
    const mime = attachment.mimeType || '';
    const isImage = /^image\//.test(mime);
    if (isImage) {
      attachmentHtml = `
        <div class="chat-attachment">
          <a href="${safeUrl}" target="_blank" rel="noreferrer">${safeName}</a>
          <div class="chat-attachment-preview">
            <img src="${safeUrl}" alt="${safeName}" />
          </div>
        </div>
      `;
    } else {
      attachmentHtml = `
        <div class="chat-attachment">
          <a href="${safeUrl}" target="_blank" rel="noreferrer">${safeName}</a>
        </div>
      `;
    }
  }

  const initials = getInitials(displayName || 'Guest');
  messageDiv.innerHTML = `
    <div class="chat-message-avatar">${initials}</div>
    <div class="chat-message-content">
      <div class="chat-message-header">
        <span class="chat-name">${escapeHtml(displayName || 'Guest')}</span>
        <span class="chat-time">${escapeHtml(timeStr)}</span>
      </div>
      ${text ? `<div class="chat-text">${escapeHtml(text)}</div>` : ''}
      ${attachmentHtml}
    </div>
  `;

  chatMessages.appendChild(messageDiv);
  if (atBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Chat form
if (chatFileInput && chatFileName) {
  chatFileInput.addEventListener('change', () => {
    const file = chatFileInput.files[0];
    if (file) {
      chatFileName.textContent = `Attachment: ${file.name}`;
    } else {
      chatFileName.textContent = '';
    }
  });
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!socket || !socket.connected || !currentChannelId) return;

  const text = chatInput.value.trim();
  const file = chatFileInput && chatFileInput.files[0];
  let attachment = null;

  if (file) {
    let uploadFile = file;
    if (
      file.type &&
      file.type.startsWith('image/') &&
      compressImagesCheckbox &&
      compressImagesCheckbox.checked
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

  socket.emit('chat-message', { text, attachment });
  chatInput.value = '';
  if (chatFileInput) chatFileInput.value = '';
  if (chatFileName) chatFileName.textContent = '';
});

// File button handler
if (fileButton && chatFileInput) {
  fileButton.addEventListener('click', () => {
    chatFileInput.click();
  });

  chatFileInput.addEventListener('change', () => {
    const file = chatFileInput.files[0];
    if (file) {
      chatFileName.textContent = `Attachment: ${file.name}`;
    } else {
      chatFileName.textContent = '';
    }
  });
}

// WhatsApp-style Emoji Picker
let recentEmojis = JSON.parse(localStorage.getItem('recentEmojis') || '[]');
let currentEmojiCategory = 'recent';

const emojiCategories = {
  recent: { name: 'Recent', icon: '🕐', emojis: [] },
  smileys: {
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸'
    ]
  },
  people: {
    name: 'People',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💪', '🦵', '🦶', '👂', '🦻', '👃', '👶', '👧',
      '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '🧑‍🦱', '👨‍🦱', '👩‍🦰', '🧑‍🦰'
    ]
  },
  animals: {
    name: 'Animals',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
      '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙'
    ]
  },
  food: {
    name: 'Food',
    icon: '🍕',
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🥞',
      '🥯', '🥐', '🍞', '🥖', '🥨', '🧀', '🥗', '🥙', '🥪', '🌮',
      '🌯', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪',
      '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧',
      '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿'
    ]
  },
  activities: {
    name: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🏹', '🎣',
      '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂',
      '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤹', '🧘', '🏌️', '🏇', '🧗'
    ]
  },
  travel: {
    name: 'Travel',
    icon: '🚗',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐',
      '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍', '🚨', '🚔', '🚍',
      '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄',
      '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬',
      '🛩', '💺', '🚁', '🚟', '🚠', '🚡', '🛰', '🚀', '🛸', '🌍'
    ]
  },
  objects: {
    name: 'Objects',
    icon: '⌚',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹',
      '🗜', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽',
      '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛',
      '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌', '💡',
      '🔦', '🕯', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '💰'
    ]
  },
  symbols: {
    name: 'Symbols',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
      '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
      '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳'
    ]
  },
  flags: {
    name: 'Flags',
    icon: '🏳️',
    emojis: [
      '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇳', '🇦🇫', '🇦🇽', '🇦🇱',
      '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼',
      '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿',
      '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳',
      '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇶', '🇮🇷', '🇮🇪', '🇮🇱'
    ]
  }
};

function addToRecent(emoji) {
  recentEmojis = recentEmojis.filter((e) => e !== emoji);
  recentEmojis.unshift(emoji);
  recentEmojis = recentEmojis.slice(0, 36);
  localStorage.setItem('recentEmojis', JSON.stringify(recentEmojis));
  emojiCategories.recent.emojis = recentEmojis;
}

function renderEmojiCategory(categoryId) {
  if (!emojiPickerContent) return;
  
  const category = emojiCategories[categoryId];
  if (!category) return;

  currentEmojiCategory = categoryId;
  
  emojiPickerContent.innerHTML = '';
  
  const grid = document.createElement('div');
  grid.className = 'emoji-grid';
  
  const emojis = categoryId === 'recent' ? recentEmojis : category.emojis;
  
  if (emojis.length === 0 && categoryId === 'recent') {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.padding = '20px';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.color = '#8a8d91';
    emptyMsg.textContent = 'No recent emojis';
    emojiPickerContent.appendChild(emptyMsg);
    return;
  }
  
  emojis.forEach((emoji) => {
    const item = document.createElement('div');
    item.className = 'emoji-item';
    item.textContent = emoji;
    item.addEventListener('click', () => {
      const cursorPos = chatInput.selectionStart || chatInput.value.length;
      const textBefore = chatInput.value.substring(0, cursorPos);
      const textAfter = chatInput.value.substring(cursorPos);
      chatInput.value = textBefore + emoji + textAfter;
      chatInput.focus();
      chatInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
      addToRecent(emoji);
      emojiPicker.classList.add('hidden');
    });
    grid.appendChild(item);
  });
  
  emojiPickerContent.appendChild(grid);
}

function initEmojiPicker() {
  if (!emojiPicker || !emojiPickerTabs) return;
  
  emojiCategories.recent.emojis = recentEmojis;
  
  // Create category tabs
  emojiPickerTabs.innerHTML = '';
  Object.keys(emojiCategories).forEach((categoryId) => {
    const tab = document.createElement('button');
    tab.className = 'emoji-tab';
    tab.textContent = emojiCategories[categoryId].icon;
    tab.title = emojiCategories[categoryId].name;
    tab.addEventListener('click', () => {
      document.querySelectorAll('.emoji-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderEmojiCategory(categoryId);
    });
    if (categoryId === 'recent') {
      tab.classList.add('active');
    }
    emojiPickerTabs.appendChild(tab);
  });
  
  // Initial render
  renderEmojiCategory('recent');
  
  // Search functionality
  if (emojiSearchInput) {
    emojiSearchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      if (!searchTerm) {
        renderEmojiCategory(currentEmojiCategory);
        return;
      }
      
      emojiPickerContent.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'emoji-grid';
      
      const allEmojis = Object.values(emojiCategories)
        .flatMap((cat) => cat.emojis)
        .filter((emoji, index, self) => self.indexOf(emoji) === index);
      
      // Simple search - you could enhance this with emoji names
      const filtered = allEmojis.slice(0, 64); // Limit results
      
      filtered.forEach((emoji) => {
        const item = document.createElement('div');
        item.className = 'emoji-item';
        item.textContent = emoji;
        item.addEventListener('click', () => {
          const cursorPos = chatInput.selectionStart || chatInput.value.length;
          const textBefore = chatInput.value.substring(0, cursorPos);
          const textAfter = chatInput.value.substring(cursorPos);
          chatInput.value = textBefore + emoji + textAfter;
          chatInput.focus();
          chatInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
          addToRecent(emoji);
          emojiPicker.classList.add('hidden');
          emojiSearchInput.value = '';
        });
        grid.appendChild(item);
      });
      
      emojiPickerContent.appendChild(grid);
    });
  }
}

// Emoji button handler
if (emojiButton && emojiPicker) {
  initEmojiPicker();
  
  emojiButton.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
    if (!emojiPicker.classList.contains('hidden')) {
      renderEmojiCategory(currentEmojiCategory);
      if (emojiSearchInput) emojiSearchInput.value = '';
    }
  });

  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
      emojiPicker.classList.add('hidden');
    }
  });
}

async function compressImageFile(file, maxDimension, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const scale = Math.min(1, maxDimension / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Voice/WebRTC
async function ensureLocalStream() {
  if (localStream) return localStream;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    localStream = stream;
    return stream;
  } catch (err) {
    console.error('Error getting microphone:', err);
    alert('Could not access microphone. Please check permissions.');
    throw err;
  }
}

function joinVoiceChannel() {
  if (!currentChannelId || currentChannelType !== 'voice') return;
  remoteParticipants.clear();
  updateVoiceParticipants();
  setStatus('Connecting to voice channel...');
}

function leaveVoiceChannel() {
  cleanupAllPeers();
  if (localStream) {
    localStream.getTracks().forEach((t) => (t.enabled = true));
  }
  isMuted = false;
  remoteParticipants.clear();
  updateVoiceParticipants();
}

function createPeerConnection(peerId, remoteDisplayName, shouldInitiate) {
  if (peerConnections.has(peerId)) {
    return peerConnections.get(peerId);
  }

  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections.set(peerId, pc);

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, localStream);
      const params = sender.getParameters();
      if (!params.encodings) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = 40000;
      sender.setParameters(params).catch((err) => console.warn('Error setting params', err));
    });
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', {
        targetId: peerId,
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = (event) => {
    const [remoteStream] = event.streams;
    let audioEl = peerAudioElements.get(peerId);
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      peerAudioElements.set(peerId, audioEl);
    }
    audioEl.srcObject = remoteStream;
    updateVoiceParticipants();
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      cleanupPeer(peerId);
    }
  };

  if (shouldInitiate) {
    (async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', {
          targetId: peerId,
          offer
        });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    })();
  }

  return pc;
}

function cleanupPeer(peerId) {
  const pc = peerConnections.get(peerId);
  if (pc) {
    pc.close();
    peerConnections.delete(peerId);
  }
  const audioEl = peerAudioElements.get(peerId);
  if (audioEl) {
    audioEl.srcObject = null;
    audioEl.remove();
    peerAudioElements.delete(peerId);
  }
  remoteParticipants.delete(peerId);
  updateVoiceParticipants();
}

function cleanupAllPeers() {
  Array.from(peerConnections.keys()).forEach((peerId) => cleanupPeer(peerId));
}

function setMuted(muted) {
  isMuted = !!muted;
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }
  muteButton.textContent = isMuted ? '🔇' : '🔊';
  muteButton.title = isMuted ? 'Unmute' : 'Mute';
  sendMuteState();
  updateVoiceParticipants();
}

function toggleMute() {
  if (!localStream || isPushToTalkEnabled) return;
  setMuted(!isMuted);
}

function sendMuteState() {
  if (socket && socket.connected) {
    socket.emit('mute-state', { muted: isMuted });
  }
}

muteButton.addEventListener('click', () => {
  toggleMute();
});

leaveButton.addEventListener('click', () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  cleanupAllPeers();
  app.classList.add('hidden');
  joinScreen.classList.remove('hidden');
});

if (pttCheckbox) {
  pttCheckbox.addEventListener('change', () => {
    isPushToTalkEnabled = pttCheckbox.checked;
    if (isPushToTalkEnabled) {
      if (localStream) {
        setMuted(true);
      }
    } else {
      isPushToTalkKeyDown = false;
    }
  });
}

window.addEventListener('keydown', (event) => {
  if (!isPushToTalkEnabled || !localStream || !currentChannelId) return;
  if (event.code === 'Space' && !isPushToTalkKeyDown) {
    event.preventDefault();
    isPushToTalkKeyDown = true;
    setMuted(false);
  }
});

window.addEventListener('keyup', (event) => {
  if (!isPushToTalkEnabled || !localStream || !currentChannelId) return;
  if (event.code === 'Space') {
    event.preventDefault();
    isPushToTalkKeyDown = false;
    setMuted(true);
  }
});

// Socket.IO events
function wireSocketEvents() {
  if (!socket) return;

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('room-info', ({ channels: channelsData, users: usersData }) => {
    channels.clear();
    channelsData.forEach((ch) => {
      channels.set(ch.id, { type: ch.type, userCount: ch.userCount });
    });
    updateChannelList();

    roomUsers.clear();
    usersData.forEach((u) => {
      roomUsers.set(u.socketId, { displayName: u.displayName });
    });
    updateMembersList();

    // Auto-join first text channel if available
    const firstTextChannel = Array.from(channels.entries()).find(
      ([, ch]) => ch.type === 'text'
    );
    if (firstTextChannel) {
      switchChannel(firstTextChannel[0]);
    }
  });

  socket.on('channels-updated', ({ channels: channelsData }) => {
    channels.clear();
    channelsData.forEach((ch) => {
      channels.set(ch.id, { type: ch.type, userCount: ch.userCount });
    });
    updateChannelList();
  });

  socket.on('channel-users', ({ channelId, users }) => {
    if (channelId !== currentChannelId) return;
    remoteParticipants.clear();
    users.forEach((user) => {
      remoteParticipants.set(user.socketId, {
        displayName: user.displayName,
        muted: false
      });
    });
    updateVoiceParticipants();

    users.forEach((user) => {
      if (user.socketId !== socket.id) {
        createPeerConnection(user.socketId, user.displayName, true);
      }
    });
  });

  socket.on('user-joined-room', ({ socketId, displayName }) => {
    roomUsers.set(socketId, { displayName });
    updateMembersList();
  });

  socket.on('user-left-room', ({ socketId }) => {
    roomUsers.delete(socketId);
    cleanupPeer(socketId);
    updateMembersList();
  });

  socket.on('user-joined-channel', ({ socketId, displayName, channelId }) => {
    if (channelId !== currentChannelId) return;
    if (currentChannelType === 'voice') {
      remoteParticipants.set(socketId, { displayName, muted: false });
      updateVoiceParticipants();
    }
  });

  socket.on('user-left-channel', ({ socketId, channelId }) => {
    if (channelId === currentChannelId && currentChannelType === 'voice') {
      cleanupPeer(socketId);
    }
  });

  socket.on('webrtc-offer', async ({ fromId, offer, displayName }) => {
    if (currentChannelType !== 'voice') return;
    try {
      await ensureLocalStream();
      if (!remoteParticipants.has(fromId)) {
        remoteParticipants.set(fromId, { displayName: displayName || 'Guest', muted: false });
      }
      const pc = createPeerConnection(fromId, displayName, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', {
        targetId: fromId,
        answer
      });
      updateVoiceParticipants();
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  });

  socket.on('webrtc-answer', async ({ fromId, answer }) => {
    const pc = peerConnections.get(fromId);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('Error setting remote answer:', err);
    }
  });

  socket.on('webrtc-ice-candidate', async ({ fromId, candidate }) => {
    const pc = peerConnections.get(fromId);
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  });

  socket.on('chat-message', (payload) => {
    const { socketId, displayName, text, timestamp, attachment, channelId } = payload || {};
    if (channelId === currentChannelId) {
      appendChatMessage({ socketId, displayName, text, timestamp, attachment });
    }
  });

  socket.on('mute-state', ({ socketId, muted }) => {
    const info = remoteParticipants.get(socketId);
    if (info) {
      info.muted = !!muted;
      updateVoiceParticipants();
    }
  });
}

window.addEventListener('beforeunload', () => {
  if (socket) socket.disconnect();
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
  }
});

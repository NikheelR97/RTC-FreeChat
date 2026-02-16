import { state } from './state.js';
import { escapeHtml, getInitials } from './utils.js';

export const elements = {
    joinScreen: document.getElementById('join-screen'),
    app: document.getElementById('app'),
    joinForm: document.getElementById('join-form'),
    displayNameInput: document.getElementById('display-name-input'),
    blockScreen: document.getElementById('block-screen'), // Potential missing element in original code? No, assuming standard IDs
    userName: document.getElementById('user-name'),
    userAvatar: document.getElementById('user-avatar'),
    textChannelsList: document.getElementById('text-channels-list'),
    voiceChannelsList: document.getElementById('voice-channels-list'),
    createChannelBtn: document.getElementById('create-channel-btn'),
    createChannelModal: document.getElementById('create-channel-modal'),
    createChannelForm: document.getElementById('create-channel-form'),
    cancelChannelBtn: document.getElementById('cancel-channel-btn'),
    channelNameInput: document.getElementById('channel-name-input'),
    channelTypeSelect: document.getElementById('channel-type-select'),
    currentChannelName: document.getElementById('current-channel-name'),
    currentChannelIcon: document.getElementById('current-channel-icon'),
    messagesArea: document.getElementById('messages-area'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    chatFileInput: document.getElementById('chat-file-input'),
    chatFileName: document.getElementById('chat-file-name'),
    fileButton: document.getElementById('file-button'),
    emojiButton: document.getElementById('emoji-button'),
    emojiPicker: document.getElementById('emoji-picker'),
    emojiPickerContent: document.getElementById('emoji-picker-content'),
    emojiPickerTabs: document.getElementById('emoji-picker-tabs'),
    emojiSearchInput: document.getElementById('emoji-search-input'),
    gifButton: document.getElementById('gif-button'),
    gifPicker: document.getElementById('gif-picker'),
    gifPickerContent: document.getElementById('gif-picker-content'),
    gifSearchInput: document.getElementById('gif-search-input'),
    compressImagesCheckbox: document.getElementById('compress-images-checkbox'),
    muteButton: document.getElementById('mute-button'),
    // leaveButton removed in previous refactor
    membersList: document.getElementById('members-list'),
    memberCount: document.getElementById('member-count'),
    statusText: document.getElementById('status-text'),
    voicePanel: document.getElementById('voice-panel'),
    voiceChannelName: document.getElementById('voice-channel-name'),
    voiceDisconnectBtn: document.getElementById('voice-disconnect-btn'),
    pttCheckbox: document.getElementById('ptt-checkbox'),
    themeToggle: document.getElementById('theme-toggle'),
    mobileMenuButton: document.getElementById('mobile-menu-button'),
    mobileMembersButton: document.getElementById('mobile-members-button'),
    sidebarLeft: document.querySelector('.sidebar-left'),
    sidebarRight: document.querySelector('.sidebar-right'),
    typingIndicator: document.getElementById('typing-indicator')
};

export function updateChannelList(switchChannelCallback) {
    // Text channels
    elements.textChannelsList.innerHTML = '';
    // Voice channels
    elements.voiceChannelsList.innerHTML = '';

    state.channels.forEach((channel, channelId) => {
        const li = document.createElement('li');
        // Check if active based on type
        const isActive = (channel.type === 'text' && channelId === state.currentTextChannelId) ||
            (channel.type === 'voice' && channelId === state.currentVoiceChannelId);

        li.className = `channel-item ${isActive ? 'active' : ''}`;
        li.innerHTML = `
      <span class="channel-icon">${channel.type === 'text' ? '#' : '🔊'}</span>
      <span>${escapeHtml(channelId)}</span>
      ${channel.userCount > 0 ? `<span style="margin-left: auto; font-size: 12px;">${channel.userCount}</span>` : ''}
    `;
        li.addEventListener('click', () => {
            if (switchChannelCallback) switchChannelCallback(channelId);
            // Close sidebar on mobile after selecting channel ONLY if it's a text channel
            if (window.innerWidth <= 768) {
                closeMobileSidebars();
            }
        });

        if (channel.type === 'text') {
            elements.textChannelsList.appendChild(li);
        } else {
            elements.voiceChannelsList.appendChild(li);
        }
    });
}

export function updateMembersList() {
    elements.membersList.innerHTML = '';
    let count = 0;

    state.roomUsers.forEach((user, socketId) => {
        count++;
        const li = document.createElement('div');
        li.className = 'member-item';
        const initials = getInitials(user.displayName);
        li.innerHTML = `
      <div class="member-avatar">${initials}</div>
      <div class="member-name">${escapeHtml(user.displayName)}</div>
      <div class="member-status"></div>
    `;
        elements.membersList.appendChild(li);
    });

    elements.memberCount.textContent = count;
}

export function updateVoicePanel() {
    const count = state.remoteParticipants.size + (state.currentVoiceChannelId ? 1 : 0);
    if (elements.statusText) {
        elements.statusText.textContent = state.currentVoiceChannelId ? `Connected (${count})` : 'Not connected';
    }
}

export function appendChatMessage({ socketId, displayName, text, timestamp, attachment }) {
    if (!elements.chatMessages) return;
    const atBottom =
        elements.chatMessages.scrollTop + elements.chatMessages.clientHeight >= elements.chatMessages.scrollHeight - 10;

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

    elements.chatMessages.appendChild(messageDiv);
    if (atBottom) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
}

// Mobile sidebar logic
let sidebarOverlay = null;

function createSidebarOverlay() {
    if (sidebarOverlay) return sidebarOverlay;
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'sidebar-overlay';
    sidebarOverlay.addEventListener('click', closeMobileSidebars);
    document.body.appendChild(sidebarOverlay);
    return sidebarOverlay;
}

export function openMobileSidebar(sidebar) {
    const overlay = createSidebarOverlay();
    sidebar.classList.add('mobile-open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

export function closeMobileSidebars() {
    if (elements.sidebarLeft) elements.sidebarLeft.classList.remove('mobile-open');
    if (elements.sidebarRight) elements.sidebarRight.classList.remove('mobile-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

export function setStatus(msg) {
    if (elements.statusText) elements.statusText.textContent = msg;
}

const typingUsers = new Set();

export function showTyping(displayName) {
    typingUsers.add(displayName);
    updateTypingIndicator();
}

export function hideTyping(displayName) {
    typingUsers.delete(displayName);
    updateTypingIndicator();
}

function updateTypingIndicator() {
    if (!elements.typingIndicator) {
        // dynamic binding if not verified
        elements.typingIndicator = document.getElementById('typing-indicator');
        if (!elements.typingIndicator) return;
    }

    if (typingUsers.size === 0) {
        elements.typingIndicator.classList.add('hidden');
        elements.typingIndicator.textContent = '';
        return;
    }

    elements.typingIndicator.classList.remove('hidden');
    const users = Array.from(typingUsers);

    if (users.length === 1) {
        elements.typingIndicator.textContent = `${users[0]} is typing...`;
    } else if (users.length === 2) {
        elements.typingIndicator.textContent = `${users[0]} and ${users[1]} are typing...`;
    } else {
        elements.typingIndicator.textContent = `${users.length} people are typing...`;
    }
}

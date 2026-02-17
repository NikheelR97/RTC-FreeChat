import { state } from './state.js';
import { elements } from './ui-core.js';
import { escapeHtml, getInitials } from './utils.js';

export function updateChannelList(switchChannelCallback) {
  if (!elements.textChannelsList || !elements.voiceChannelsList) return;

  elements.textChannelsList.innerHTML = '';
  elements.voiceChannelsList.innerHTML = '';

  state.channels.forEach((channel, channelId) => {
    const li = document.createElement('li');
    const isActive =
      (channel.type === 'text' && channelId === state.currentTextChannelId) ||
      (channel.type === 'voice' && channelId === state.currentVoiceChannelId);

    li.className = `channel-item ${isActive ? 'active' : ''}`;
    li.style.padding = '10px 16px';
    li.style.cursor = 'pointer';
    li.style.color = isActive ? 'var(--accent)' : 'var(--text-dim)';
    li.style.fontWeight = isActive ? '600' : '400';
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';

    li.innerHTML = `
            <span class="channel-name-text"># ${escapeHtml(channelId)}</span>
            ${channel.userCount > 0 ? `<span class="badge" style="margin-left:auto">${channel.userCount}</span>` : ''}
        `;

    li.addEventListener('click', () => {
      if (switchChannelCallback) switchChannelCallback(channelId);
      document.body.classList.remove('drawer-open-left');
    });

    if (channel.type === 'text') {
      elements.textChannelsList.appendChild(li);
    } else {
      elements.voiceChannelsList.appendChild(li);
    }
  });
}

export function updateMembersList() {
  if (!elements.membersList) return;
  elements.membersList.innerHTML = '';
  let count = 0;

  state.roomUsers.forEach((user, socketId) => {
    count++;
    const div = document.createElement('div');
    div.className = 'member-item';
    div.style.padding = '10px 16px';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '12px';

    const initials = getInitials(user.displayName);
    const statusColor = `var(--status-${user.status || 'offline'})`;

    div.innerHTML = `
            <div class="member-avatar-container" style="position: relative;">
                <div class="member-avatar" style="width:32px;height:32px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff">${initials}</div>
                <div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; border-radius: 50%; background: ${statusColor}; border: 2px solid var(--bg-dark);"></div>
            </div>
            <div class="member-name" style="font-size:14px">${escapeHtml(user.displayName)}</div>
        `;
    elements.membersList.appendChild(div);
  });

  if (elements.memberCount) elements.memberCount.textContent = count;
}

export function createStatusPicker() {
  // Check if it already exists in drawer-left
  if (document.getElementById('status-picker')) return;

  const drawerLeft = elements.drawerLeft; // ensure this is defined
  if (!drawerLeft) return;

  const container = document.createElement('div');
  container.id = 'status-picker';
  container.style.padding = '16px';
  container.style.borderTop = 'var(--glass-border)';

  container.innerHTML = `
        <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Set Status</div>
        <div style="display: flex; gap: 8px;">
            <button class="status-btn" data-status="online" style="width: 24px; height: 24px; border-radius: 50%; background: var(--status-online); border: none; cursor: pointer; transition: transform 0.2s;"></button>
            <button class="status-btn" data-status="idle" style="width: 24px; height: 24px; border-radius: 50%; background: var(--status-idle); border: none; cursor: pointer; transition: transform 0.2s;"></button>
            <button class="status-btn" data-status="dnd" style="width: 24px; height: 24px; border-radius: 50%; background: var(--status-dnd); border: none; cursor: pointer; transition: transform 0.2s;"></button>
        </div>
        
        <div style="margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">
             <button id="sound-toggle-btn" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); padding: 8px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; font-size: 13px; transition: all 0.2s;">
                <span>🔊</span> <span>Sounds: ON</span>
             </button>
        </div>
    `;

  // Status logic
  container.querySelectorAll('.status-btn').forEach((btn) => {
    btn.onmouseover = () => (btn.style.transform = 'scale(1.2)');
    btn.onmouseout = () => (btn.style.transform = 'scale(1)');
    btn.onclick = () => {
      const status = btn.dataset.status;
      state.socket.emit('status-change', { status });
    };
  });

  // Sound logic
  const soundBtn = container.querySelector('#sound-toggle-btn');
  if (soundBtn) {
    soundBtn.onclick = () => {
      state.isSoundEnabled = !state.isSoundEnabled;
      const icon = state.isSoundEnabled ? '🔊' : '🔇';
      const text = state.isSoundEnabled ? 'ON' : 'OFF';
      soundBtn.innerHTML = `<span>${icon}</span> <span>Sounds: ${text}</span>`;
      soundBtn.style.color = state.isSoundEnabled ? 'var(--text-dim)' : 'var(--danger)';
      soundBtn.style.borderColor = state.isSoundEnabled ? 'rgba(255,255,255,0.1)' : 'var(--danger)';
    };
  }

  drawerLeft.appendChild(container); // Append to bottom for now
}

export function updateVoicePanel() {
  if (!elements.voicePanel) return;
  // Update Voice Control Visibility
  if (state.currentVoiceChannelId) {
    elements.voicePanel.classList.remove('hidden');
    if (elements.voiceChannelName)
      elements.voiceChannelName.textContent = state.currentVoiceChannelId;
  } else {
    elements.voicePanel.classList.add('hidden');
  }
}

export function setStatus(msg) {
  // console.log(msg);
}

export function showTyping(displayName) {
  if (elements.typingIndicator) {
    elements.typingIndicator.textContent = `${displayName} is typing...`;
    elements.typingIndicator.classList.remove('hidden');
  }
}

export function hideTyping(displayName) {
  if (elements.typingIndicator) {
    elements.typingIndicator.classList.add('hidden');
  }
}

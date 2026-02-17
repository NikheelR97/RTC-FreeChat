import { state } from './state.js';
import { elements } from './ui-core.js';
import { escapeHtml, getInitials } from './utils.js';
import { openThread } from './ui-drawers.js'; // Dependency
import { sounds } from './sounds.js';

let lastMessage = null;

export function appendChatMessage({
  id,
  socketId,
  displayName,
  text,
  timestamp,
  attachment,
  isOwnMessage,
  reactions,
  replies,
  replyCount,
}) {
  if (!elements.chatMessages) return;
  const atBottom =
    Math.abs(
      elements.chatMessages.scrollHeight -
        elements.chatMessages.scrollTop -
        elements.chatMessages.clientHeight
    ) < 50;

  const time = timestamp ? new Date(timestamp) : new Date();

  // Grouping
  const isSameSender =
    lastMessage && lastMessage.socketId === socketId && lastMessage.displayName === displayName;

  // Simple Bubble
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;
  if (id) messageDiv.id = `msg-${id}`;
  if (isSameSender) messageDiv.classList.add('chat-message-grouped');

  let contentHtml = '';
  if (text) contentHtml += `<div class="chat-text">${escapeHtml(text)}</div>`;

  if (attachment && attachment.url) {
    if (attachment.mimeType && attachment.mimeType.startsWith('image/')) {
      const imgId = `img-${id || Date.now()}`;
      contentHtml += `<div class="chat-attachment">
                <img id="${imgId}" src="${attachment.url}" alt="${escapeHtml(attachment.originalName || 'Image')}" loading="lazy" 
                style="max-width:100%; max-height:200px; object-fit: cover; border-radius: 8px; margin-top: 4px; display: block; cursor: zoom-in;" 
                onclick="window.openLightbox('${attachment.url}', '${escapeHtml(attachment.originalName || 'Image')}')" />
            </div>`;
    } else {
      // File setup
      const fileName = escapeHtml(attachment.originalName || 'File');
      const sizeStr = attachment.size
        ? ` <span style="font-size: 10px; opacity: 0.7;">(${(attachment.size / 1024).toFixed(1)} KB)</span>`
        : '';

      contentHtml += `<div class="chat-attachment" style="margin-top: 4px;">
                <a href="${attachment.url}" target="_blank" style="text-decoration: none; display: flex; align-items: center; gap: 10px; background: var(--bg-secondary); border: 1px solid rgba(255,255,255,0.1); padding: 10px 14px; border-radius: 12px; transition: background 0.2s;">
                    <div style="font-size: 24px;">📄</div>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 500; color: var(--text-main);">${fileName}</span>
                        ${sizeStr}
                    </div>
                    <div style="margin-left: auto; opacity: 0.5;">⬇️</div>
                </a>
            </div>`;
    }
  }

  if (!isSameSender && !isOwnMessage) {
    messageDiv.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;margin-left:4px;">${escapeHtml(displayName)}</div>${contentHtml}`;
  } else {
    messageDiv.innerHTML = contentHtml;
  }

  // Message Footer (Reactions + Reply)
  const footerDiv = document.createElement('div');
  footerDiv.className = 'message-footer';
  footerDiv.style.display = 'flex';
  footerDiv.style.alignItems = 'center';
  footerDiv.style.flexWrap = 'wrap';
  footerDiv.style.marginTop = '4px';
  footerDiv.style.gap = '8px';

  // Reactions Container
  const reactionsDiv = document.createElement('div');
  reactionsDiv.className = 'message-reactions';
  reactionsDiv.style.display = 'inline-flex';
  reactionsDiv.style.flexWrap = 'wrap';
  reactionsDiv.style.gap = '4px';

  footerDiv.appendChild(reactionsDiv);

  // Reply Button (Logo/Icon)
  const count = replyCount || (replies ? replies.length : 0);
  const replyBtn = document.createElement('button');
  replyBtn.className = 'reply-btn';
  replyBtn.title = 'Reply in Thread';

  // Style as a small icon next to pills
  replyBtn.style.border = 'none';

  // Better visibility on blue bubbles (own messages)
  if (isOwnMessage) {
    replyBtn.style.background = 'rgba(0,0,0,0.2)'; // Darker pill background for contrast
    replyBtn.style.color = '#ffffff'; // Pure white
  } else {
    replyBtn.style.background = 'rgba(255,255,255,0.05)';
    replyBtn.style.color = 'var(--text-dim)';
  }

  replyBtn.style.cursor = 'pointer';
  replyBtn.style.padding = '2px 6px';
  replyBtn.style.borderRadius = '12px'; // Pill shape like reactions
  replyBtn.style.display = 'flex';
  replyBtn.style.alignItems = 'center';
  replyBtn.style.gap = '4px';
  replyBtn.style.fontSize = '11px';
  replyBtn.style.transition = 'all 0.2s';
  replyBtn.style.height = '20px'; // Match reaction pill height approx

  // Icon + Optional Count
  // Use white for count on own message too
  const countColor = isOwnMessage ? 'white' : 'var(--accent)';

  replyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 17 4 12 9 7"></polyline>
            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
        </svg>
        ${count > 0 ? `<span style="font-weight:600; color:${countColor};">${count}</span>` : ''}
    `;

  replyBtn.onmouseover = () => {
    if (isOwnMessage) {
      replyBtn.style.background = 'rgba(0,0,0,0.3)'; // Even darker on hover
    } else {
      replyBtn.style.background = 'rgba(255,255,255,0.1)';
      replyBtn.style.color = 'var(--text-main)';
    }
  };
  replyBtn.onmouseout = () => {
    if (isOwnMessage) {
      replyBtn.style.background = 'rgba(0,0,0,0.2)';
    } else {
      replyBtn.style.background = 'rgba(255,255,255,0.05)';
      replyBtn.style.color = 'var(--text-dim)';
    }
  };

  replyBtn.onclick = (e) => {
    e.stopPropagation();
    openThread({ id, socketId, displayName, text, timestamp, attachment, replies });
  };

  footerDiv.appendChild(replyBtn);
  messageDiv.appendChild(footerDiv);

  elements.chatMessages.appendChild(messageDiv);

  if (!isOwnMessage && state.isSoundEnabled && sounds.message) {
    sounds.message();
  }

  if (reactions && id) {
    updateMessageReactions(id, reactions);
  } else {
    if (id) updateMessageReactions(id, {});
  }

  lastMessage = { socketId, displayName, time };

  if (atBottom) {
    setTimeout(() => (elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight), 10);
  }
}

export function updateMessageReactions(messageId, reactions) {
  const messageEl = document.getElementById(`msg-${messageId}`);
  if (!messageEl) return;

  // Check for footer
  let footer = messageEl.querySelector('.message-footer');
  if (!footer) {
    // Create footer if missing (backward compatibility or if message structure varies)
    footer = document.createElement('div');
    footer.className = 'message-footer';
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.flexWrap = 'wrap';
    footer.style.marginTop = '4px';
    footer.style.gap = '8px';
    messageEl.appendChild(footer);
  }

  let reactionsContainer = footer.querySelector('.message-reactions');
  if (!reactionsContainer) {
    reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    reactionsContainer.style.display = 'inline-flex';
    reactionsContainer.style.flexWrap = 'wrap';
    reactionsContainer.style.gap = '4px';

    // Insert before reply-btn if exists, else append
    const replyBtn = footer.querySelector('.reply-btn');
    if (replyBtn) {
      footer.insertBefore(reactionsContainer, replyBtn);
    } else {
      footer.appendChild(reactionsContainer);
    }
  }

  reactionsContainer.innerHTML = '';

  if (reactions) {
    Object.entries(reactions).forEach(([emoji, data]) => {
      if (data.count > 0) {
        const pill = document.createElement('button');
        pill.className = `reaction-pill ${data.users.includes(state.socket.id) ? 'active' : ''}`;
        pill.innerHTML = `${emoji} <span style="font-size: 10px; margin-left: 4px;">${data.count}</span>`;

        // Disable click if own message
        if (messageEl.classList.contains('own-message')) {
          pill.style.cursor = 'default';
          pill.onclick = (e) => e.stopPropagation();
        } else {
          pill.onclick = () => {
            if (data.users.includes(state.socket.id)) {
              state.socket.emit('reaction-remove', {
                channelId: state.currentTextChannelId,
                messageId,
                emoji,
              });
            } else {
              state.socket.emit('reaction-add', {
                channelId: state.currentTextChannelId,
                messageId,
                emoji,
              });
            }
          };
        }
        reactionsContainer.appendChild(pill);
      }
    });
  }

  // Add Reaction Button - Only if NOT own message
  if (!messageEl.classList.contains('own-message')) {
    const addBtn = document.createElement('button');
    addBtn.className = 'reaction-add-btn';
    addBtn.innerHTML = '☺+';
    addBtn.title = 'Add Reaction';

    addBtn.onclick = (e) => {
      e.stopPropagation();

      const existing = document.querySelectorAll('.reaction-palette');
      existing.forEach((el) => el.remove());

      const palette = document.createElement('div');
      palette.className = 'reaction-palette';

      const emojis = ['❤️', '👍', '👎', '😢', '😂', '🔥'];

      emojis.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.className = 'reaction-palette-btn';
        btn.textContent = emoji;
        btn.onclick = (ev) => {
          ev.stopPropagation();
          state.socket.emit('reaction-add', {
            channelId: state.currentTextChannelId,
            messageId,
            emoji,
          });
          palette.remove();
        };
        palette.appendChild(btn);
      });

      addBtn.style.position = 'relative';
      addBtn.appendChild(palette);

      const closeHandler = () => {
        palette.remove();
        document.removeEventListener('click', closeHandler);
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    };

    reactionsContainer.appendChild(addBtn);
  }
}

export function appendThreadReply(reply) {
  if (!elements.threadMessages) return;

  const div = document.createElement('div');
  div.className = 'thread-reply';
  div.style.padding = '8px 0';
  div.style.display = 'flex';
  div.style.gap = '12px';
  div.style.animation = 'fadeIn 0.2s ease-out';

  const initials = getInitials(reply.displayName);
  const timeStr = new Date(reply.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  div.innerHTML = `
        <div style="width:24px;height:24px;background:rgba(255,255,255,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;flex-shrink:0;">${initials}</div>
        <div style="flex:1; min-width:0;">
             <div style="display:flex;align-items:center;gap:8px;">
                 <strong style="font-size:12px;color:var(--text-dim);">${escapeHtml(reply.displayName)}</strong>
                 <span style="font-size:10px;color:var(--text-dim);opacity:0.7;">${timeStr}</span>
             </div>
             <div style="margin-top:2px;color:var(--text-main);font-size:13px;word-break:break-word;">${escapeHtml(reply.text)}</div>
        </div>
    `;
  elements.threadMessages.appendChild(div);
  elements.threadMessages.scrollTop = elements.threadMessages.scrollHeight;
}

export function updateThreadView(replies) {
  if (!elements.threadMessages) return;
  // Simple re-render of replies for now
  // Keep parent message (first child)
  const parent = elements.threadMessages.firstElementChild;
  elements.threadMessages.innerHTML = '';
  if (parent) elements.threadMessages.appendChild(parent);

  replies.forEach((reply) => appendThreadReply(reply));
}

export function updateMessageReplyCount(messageId, count) {
  const messageEl = document.getElementById(`msg-${messageId}`);
  if (!messageEl) return;

  // Find reply button
  const replyBtn = messageEl.querySelector('.reply-btn');
  if (replyBtn) {
    const isOwn = messageEl.classList.contains('own-message');
    const countColor = isOwn ? 'white' : 'var(--accent)';

    replyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 17 4 12 9 7"></polyline>
                <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
            </svg>
            ${count > 0 ? `<span style="font-weight:600; color:${countColor};">${count}</span>` : ''}
        `;
  }
}

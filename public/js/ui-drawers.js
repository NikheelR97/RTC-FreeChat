import { state } from './state.js';
import { elements } from './ui-core.js';
import { escapeHtml, getInitials } from './utils.js';
import { appendThreadReply } from './ui-chat.js';

export let currentThreadId = null;

// Drawer Manager
export function toggleRightDrawer(targetDrawerId) {
  const drawers = ['drawer-right', 'drawer-gallery', 'drawer-thread'];
  const targetEl = document.getElementById(targetDrawerId);

  if (!targetEl) return;

  // Check if target is currently open (is visible AND body has open class)
  const isTargetOpen =
    !targetEl.classList.contains('hidden') && document.body.classList.contains('drawer-open-right');

  if (isTargetOpen) {
    // Close it
    targetEl.classList.add('hidden');
    document.body.classList.remove('drawer-open-right');
  } else {
    // Open it: Hide others first
    drawers.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el !== targetEl) el.classList.add('hidden');
    });

    targetEl.classList.remove('hidden');
    document.body.classList.add('drawer-open-right');

    // Trigger renders if needed
    if (targetDrawerId === 'drawer-gallery') renderGallery();
  }
}

export function toggleGallery() {
  toggleRightDrawer('drawer-gallery');
}

export function toggleMembers() {
  toggleRightDrawer('drawer-right');
}

export function toggleThread() {
  toggleRightDrawer('drawer-thread');
}

// Sidebars -> Drawers mapping for compatibility if needed
export function openMobileSidebar(sidebar) {
  if (sidebar === elements.drawerLeft) document.body.classList.add('drawer-open-left');
  if (sidebar === elements.drawerRight) document.body.classList.add('drawer-open-right');
}

export function closeMobileSidebars() {
  document.body.classList.remove('drawer-open-left', 'drawer-open-right');
}

// Thread Logic
export function openThread(message) {
  if (!elements.drawerThread) return;

  currentThreadId = message.id;
  // Use unified toggle to open thread drawer
  // But we need to prep it first

  // We can't use toggleRightDrawer directly if we want to force open safely without toggling off if already open?
  // Actually toggleRightDrawer checks 'isTargetOpen'. If it is open, it closes it.
  // We want to FORCE open.
  // So let's manually manage drawers here similar to toggleRightDrawer but force open.

  const drawers = ['drawer-right', 'drawer-gallery', 'drawer-thread'];
  drawers.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el !== elements.drawerThread) el.classList.add('hidden');
  });

  elements.drawerThread.classList.remove('hidden');
  document.body.classList.add('drawer-open-right');

  elements.threadMessages.innerHTML = '';

  // Render Parent Message
  const parentDiv = document.createElement('div');
  parentDiv.className = 'thread-parent-message';
  parentDiv.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
  parentDiv.style.marginBottom = '16px';
  parentDiv.style.paddingBottom = '16px';

  const initials = getInitials(message.displayName);
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  parentDiv.innerHTML = `
        <div style="display:flex; gap:12px;">
            <div style="width:32px;height:32px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;flex-shrink:0;">${initials}</div>
            <div style="flex:1; min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;">
                     <strong style="color:var(--accent);font-size:14px;">${escapeHtml(message.displayName)}</strong>
                     <span style="font-size:11px;color:var(--text-dim);">${timeStr}</span>
                </div>
                <div style="margin-top:4px;color:var(--text-main);font-size:14px;line-height:1.4;word-break:break-word;">${escapeHtml(message.text || '')}</div>
                ${message.attachment ? `<div style="margin-top:8px;font-size:12px;color:var(--accent);">[Attachment: ${escapeHtml(message.attachment.originalName)}]</div>` : ''}
            </div>
        </div>
    `;
  elements.threadMessages.appendChild(parentDiv);

  // Render Replies
  if (message.replies) {
    message.replies.forEach((reply) => appendThreadReply(reply));
  }

  // Fetch latest replies from server to ensure we are up to date
  if (state.socket && state.currentTextChannelId) {
    state.socket.emit('get-thread', {
      channelId: state.currentTextChannelId,
      messageId: message.id,
    });
  }
}

export function closeThread() {
  if (!elements.drawerThread) return;
  elements.drawerThread.classList.add('hidden');
  document.body.classList.remove('drawer-open-right');
  currentThreadId = null;

  // If members was default, maybe restore?
  if (elements.drawerRight) elements.drawerRight.classList.remove('hidden');
}

// Gallery Logic
let currentGalleryTab = 'images';

function renderGallery() {
  if (!elements.galleryGrid || !state.currentTextChannelId) return;

  const messages = state.channelMessages.get(state.currentTextChannelId) || [];
  const attachments = messages.filter((m) => m.attachment && m.attachment.url);

  elements.galleryGrid.innerHTML = '';

  let filtered = [];
  if (currentGalleryTab === 'images') {
    filtered = attachments.filter(
      (m) => m.attachment.mimeType && m.attachment.mimeType.startsWith('image/')
    );
    elements.galleryGrid.style.display = 'grid';
  } else {
    filtered = attachments.filter(
      (m) => !m.attachment.mimeType || !m.attachment.mimeType.startsWith('image/')
    );
    elements.galleryGrid.style.display = 'block'; // List for files
  }

  if (filtered.length === 0) {
    elements.galleryGrid.innerHTML = `<div style="text-align: center; color: var(--text-dim); margin-top: 40px; grid-column: 1/-1;">No ${currentGalleryTab} found</div>`;
    return;
  }

  filtered.forEach((msg) => {
    if (currentGalleryTab === 'images') {
      const div = document.createElement('div');
      div.className = 'gallery-item';
      div.innerHTML = `<img src="${msg.attachment.url}" loading="lazy" />`;
      div.onclick = () => window.openLightbox(msg.attachment.url, msg.attachment.originalName);
      elements.galleryGrid.appendChild(div);
    } else {
      const div = document.createElement('div');
      div.className = 'file-item-card';
      div.innerHTML = `
                <div style="font-size: 24px;">📄</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:500; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(msg.attachment.originalName)}</div>
                    <div style="font-size:12px; color:var(--text-dim);">${new Date(msg.timestamp).toLocaleDateString()}</div>
                </div>
                <a href="${msg.attachment.url}" download target="_blank" class="icon-button" style="text-decoration:none;">⬇️</a>
             `;
      elements.galleryGrid.appendChild(div);
    }
  });
}

// Init Gallery Events
// We need to run this once.
if (elements.galleryToggleBtn) elements.galleryToggleBtn.onclick = toggleGallery;
if (elements.closeGalleryBtn)
  elements.closeGalleryBtn.onclick = () => elements.galleryDrawer.classList.add('hidden');

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentGalleryTab = btn.dataset.tab;
    renderGallery();
  };
});

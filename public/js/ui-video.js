import { state } from './state.js';
import { getInitials } from './utils.js';

export function renderVideo(peerId, stream, isLocal = false) {
  const callGrid = document.getElementById('call-grid') || createCallGrid();

  let videoContainer = document.getElementById(`video-container-${peerId}`);
  if (!videoContainer) {
    videoContainer = document.createElement('div');
    videoContainer.id = `video-container-${peerId}`;
    videoContainer.className = 'video-card';
    if (isLocal) videoContainer.classList.add('local-video');

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    if (isLocal) video.muted = true; // Always mute local video to prevent echo
    video.className = 'video-feed';

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = isLocal ? 'You' : state.roomUsers.get(peerId)?.displayName || 'User';

    // Fullscreen Button
    const fsBtn = document.createElement('button');
    fsBtn.className = 'video-fullscreen-btn';
    fsBtn.innerHTML = '⛶'; // Unicode styling for expand
    fsBtn.title = 'Fullscreen';
    fsBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent external clicks
      toggleFullscreen(videoContainer);
    };

    // Avatar Placeholder (for audio-only)
    const avatar = document.createElement('div');
    avatar.className = 'video-avatar-placeholder';
    avatar.textContent = getInitials(state.roomUsers.get(peerId)?.displayName || 'User');
    avatar.style.display = 'none'; // Hidden by default, shown if video hidden

    videoContainer.appendChild(video);
    videoContainer.appendChild(label);
    videoContainer.appendChild(fsBtn);
    videoContainer.appendChild(avatar);
    callGrid.appendChild(videoContainer);

    // Show the grid
    callGrid.classList.remove('hidden');
  }

  const videoEl = videoContainer.querySelector('video');
  const avatarEl = videoContainer.querySelector('.video-avatar-placeholder');

  if (stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled) {
    if (videoEl.srcObject !== stream) videoEl.srcObject = stream;
    videoEl.style.display = 'block';
    if (avatarEl) avatarEl.style.display = 'none';
  } else {
    videoEl.style.display = 'none';
    if (avatarEl) avatarEl.style.display = 'flex';
  }
}

export function setVideoVisible(peerId, visible) {
  const container = document.getElementById(`video-container-${peerId}`);
  if (!container) return;

  const videoEl = container.querySelector('video');
  const avatarEl = container.querySelector('.video-avatar-placeholder');

  if (visible) {
    if (videoEl) videoEl.style.display = 'block';
    if (avatarEl) avatarEl.style.display = 'none';
  } else {
    if (videoEl) videoEl.style.display = 'none';
    if (avatarEl) avatarEl.style.display = 'flex';
  }
}

function toggleFullscreen(element) {
  if (!document.fullscreenElement) {
    element.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

export function removeVideo(peerId) {
  const container = document.getElementById(`video-container-${peerId}`);
  if (container) {
    container.remove();
  }

  // Hide grid if empty
  const callGrid = document.getElementById('call-grid');
  if (callGrid && callGrid.children.length === 0) {
    callGrid.classList.add('hidden');
  }
}

export function setSpeaking(peerId, isSpeaking) {
  const container = document.getElementById(`video-container-${peerId}`);
  if (container) {
    if (isSpeaking) {
      container.classList.add('speaking');
    } else {
      container.classList.remove('speaking');
    }
  }
}

function createCallGrid() {
  // Check if exists
  let grid = document.getElementById('call-grid');
  if (grid) return grid;

  // Create it
  grid = document.createElement('div');
  grid.id = 'call-grid';
  grid.className = 'call-grid hidden';

  // Insert into viewport (maybe above messages?)
  const viewport = document.querySelector('.messages-scroll-area');
  if (viewport) {
    viewport.insertBefore(grid, viewport.firstChild);
  }
  return grid;
}

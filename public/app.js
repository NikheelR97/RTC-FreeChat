// Basic Socket.IO + WebRTC audio mesh for simple voice rooms

const joinForm = document.getElementById('join-form');
const displayNameInput = document.getElementById('display-name-input');
const roomIdInput = document.getElementById('room-id-input');
const roomCard = document.getElementById('room-card');
const roomTitle = document.getElementById('room-title');
const statusText = document.getElementById('status-text');
const participantsList = document.getElementById('participants-list');
const muteButton = document.getElementById('mute-button');
const leaveButton = document.getElementById('leave-button');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const pttCheckbox = document.getElementById('ptt-checkbox');

let socket = null;
let localStream = null;
let currentRoomId = null;
let currentDisplayName = null;
let isMuted = false;
let isPushToTalkEnabled = false;
let isPushToTalkKeyDown = false;

// Peer connection maps
const peerConnections = new Map(); // socketId -> RTCPeerConnection
const peerAudioElements = new Map(); // socketId -> HTMLAudioElement
const remoteParticipants = new Map(); // socketId -> { displayName, muted }

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function setStatus(text) {
  statusText.textContent = text;
}

function updateParticipantsList() {
  participantsList.innerHTML = '';

  // Add local user
  if (currentDisplayName) {
    const li = document.createElement('li');
    li.className = 'participant-item';
    li.innerHTML = `
      <div class="participant-name">
        <span class="presence-dot"></span>
        <span>${escapeHtml(currentDisplayName)}</span>
        <span class="pill me">You</span>
      </div>
      <span class="pill ${isMuted ? 'muted' : ''}">${isMuted ? 'Muted' : 'Live'}</span>
    `;
    participantsList.appendChild(li);
  }

  // Add remote peers we know about
  remoteParticipants.forEach((info) => {
    const displayName = info.displayName || 'Guest';
    const isPeerMuted = !!info.muted;
    const li = document.createElement('li');
    li.className = 'participant-item';
    li.innerHTML = `
      <div class="participant-name">
        <span class="presence-dot"></span>
        <span>${escapeHtml(displayName)}</span>
      </div>
      <span class="pill ${isPeerMuted ? 'muted' : ''}">${isPeerMuted ? 'Muted' : 'Listening'}</span>
    `;
    participantsList.appendChild(li);
  });
}

function appendChatMessage({ socketId, displayName, text, timestamp }) {
  if (!chatMessages) return;
  const atBottom =
    chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 10;

  const wrapper = document.createElement('div');
  const isMe = socket && socketId === socket.id;
  wrapper.className = `chat-message ${isMe ? 'chat-message-me' : ''}`;

  const time = timestamp ? new Date(timestamp) : new Date();
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.innerHTML = `
    <div class="chat-meta">
      <span class="chat-name">${escapeHtml(displayName || 'Guest')}</span>
      <span class="chat-time">${escapeHtml(timeStr)}</span>
    </div>
    <div class="chat-text">${escapeHtml(text)}</div>
  `;

  chatMessages.appendChild(wrapper);
  if (atBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[ch] || ch;
  });
}

async function ensureLocalStream() {
  if (localStream) return localStream;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
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

function createPeerConnection(peerId, remoteDisplayName, shouldInitiate) {
  if (peerConnections.has(peerId)) {
    return peerConnections.get(peerId);
  }

  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections.set(peerId, pc);

  // Add local audio tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
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
      audioEl.dataset.displayName = remoteDisplayName || 'Guest';
      audioEl.dataset.muted = 'false';
      peerAudioElements.set(peerId, audioEl);
    }
    audioEl.srcObject = remoteStream;
    updateParticipantsList();
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      cleanupPeer(peerId);
    }
  };

  if (shouldInitiate) {
    // Create and send offer
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
  updateParticipantsList();
}

function cleanupAllPeers() {
  Array.from(peerConnections.keys()).forEach((peerId) => cleanupPeer(peerId));
}

function setMuted(muted) {
  isMuted = !!muted;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !isMuted;
  });
  muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
  sendMuteState();
  updateParticipantsList();
}

function toggleMute() {
  if (!localStream) return;
  // In push-to-talk mode, manual toggle is disabled
  if (isPushToTalkEnabled) return;
  setMuted(!isMuted);
}

function sendMuteState() {
  if (socket && socket.connected) {
    socket.emit('mute-state', { muted: isMuted });
  }
}

function leaveRoom() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  cleanupAllPeers();
  currentRoomId = null;
  isMuted = false;
  isPushToTalkKeyDown = false;
  remoteParticipants.clear();
  roomCard.classList.add('hidden');
  muteButton.disabled = true;
  leaveButton.disabled = true;
  setStatus('Not connected');
  if (chatMessages) {
    chatMessages.innerHTML = '';
  }
  updateParticipantsList();
}

joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const displayName = displayNameInput.value.trim();
  const roomId = roomIdInput.value.trim();

  if (!displayName || !roomId) return;

  currentDisplayName = displayName;
  currentRoomId = roomId;

  await ensureLocalStream();

  if (!socket) {
    socket = io();
    wireSocketEvents();
  } else if (!socket.connected) {
    socket.connect();
  }

  roomTitle.textContent = `Room: ${roomId}`;
  roomCard.classList.remove('hidden');
  muteButton.disabled = false;
  leaveButton.disabled = false;
  setStatus('Connecting…');
  updateParticipantsList();

  socket.emit('join-room', { roomId, displayName });
});

muteButton.addEventListener('click', () => {
  toggleMute();
});

leaveButton.addEventListener('click', () => {
  leaveRoom();
});

if (chatForm) {
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text || !socket || !socket.connected) return;
    socket.emit('chat-message', { text });
    chatInput.value = '';
  });
}

if (pttCheckbox) {
  pttCheckbox.addEventListener('change', () => {
    isPushToTalkEnabled = pttCheckbox.checked;
    if (isPushToTalkEnabled) {
      if (localStream) {
        setMuted(true);
      } else {
        isMuted = true;
      }
      muteButton.disabled = true;
      muteButton.textContent = 'Muted (push-to-talk)';
    } else {
      muteButton.disabled = false;
      muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
      isPushToTalkKeyDown = false;
    }
  });
}

function wireSocketEvents() {
  if (!socket) return;

  socket.on('connect', () => {
    setStatus('Connected. Waiting for peers…');
  });

  socket.on('disconnect', () => {
    setStatus('Disconnected');
  });

  socket.on('room-users', ({ users }) => {
    // Existing peers in the room: create connections and initiate offers to each
    remoteParticipants.clear();
    users.forEach((user) => {
      const { socketId, displayName } = user;
      if (socketId === socket.id) return;
       remoteParticipants.set(socketId, {
        displayName: displayName || 'Guest',
        muted: false
      });
      createPeerConnection(socketId, displayName, true);
    });
    if (users.length === 0) {
      setStatus('You are alone in this room for now.');
    } else {
      setStatus(`Connected to ${users.length} other participant(s).`);
    }
    updateParticipantsList();
  });

  socket.on('user-joined', ({ socketId, displayName }) => {
    // New user joined; they will send offers to us.
    setStatus('New participant joined.');
    if (socketId !== socket.id) {
      remoteParticipants.set(socketId, {
        displayName: displayName || 'Guest',
        muted: false
      });
      updateParticipantsList();
    }
  });

  socket.on('user-left', ({ socketId }) => {
    cleanupPeer(socketId);
    remoteParticipants.delete(socketId);
    updateParticipantsList();
    setStatus('A participant left the room.');
  });

  socket.on('webrtc-offer', async ({ fromId, offer, displayName }) => {
    try {
      await ensureLocalStream();
      if (!remoteParticipants.has(fromId)) {
        remoteParticipants.set(fromId, {
          displayName: displayName || 'Guest',
          muted: false
        });
      }
      const pc = createPeerConnection(fromId, displayName, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', {
        targetId: fromId,
        answer
      });
      updateParticipantsList();
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

  socket.on('chat-message', ({ socketId, displayName, text, timestamp }) => {
    appendChatMessage({ socketId, displayName, text, timestamp });
  });

  socket.on('mute-state', ({ socketId, muted }) => {
    const info = remoteParticipants.get(socketId) || {};
    info.muted = !!muted;
    remoteParticipants.set(socketId, info);
    const audioEl = peerAudioElements.get(socketId);
    if (audioEl) {
      audioEl.dataset.muted = muted ? 'true' : 'false';
    }
    updateParticipantsList();
  });
}

window.addEventListener('keydown', (event) => {
  if (!isPushToTalkEnabled || !localStream || !currentRoomId) return;
  if (event.code === 'Space' && !isPushToTalkKeyDown) {
    event.preventDefault();
    isPushToTalkKeyDown = true;
    setMuted(false);
  }
});

window.addEventListener('keyup', (event) => {
  if (!isPushToTalkEnabled || !localStream || !currentRoomId) return;
  if (event.code === 'Space') {
    event.preventDefault();
    isPushToTalkKeyDown = false;
    setMuted(true);
  }
});

window.addEventListener('beforeunload', () => {
  leaveRoom();
});


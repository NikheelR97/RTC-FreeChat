export const state = {
  socket: null,
  localStream: null,
  currentRoomId: null,
  currentDisplayName: null,
  currentTextChannelId: null,
  currentVoiceChannelId: null,
  isMuted: false,
  isPushToTalkEnabled: false,
  isPushToTalkKeyDown: false,
  channels: new Map(), // channelId -> { type, userCount }
  roomUsers: new Map(), // socketId -> { displayName }
  remoteParticipants: new Map(), // socketId -> { displayName, muted }
  peerConnections: new Map(),
  peerAudioElements: new Map(),
  peerVideoElements: new Map(), // socketId -> videoElement
  isVideoEnabled: false,
  isScreenSharing: false,
  screenStream: null,
  channelMessages: new Map(), // channelId -> [messages]
  isSoundEnabled: true,
};

export function setSocket(socket) {
  state.socket = socket;
}

export function setLocalStream(stream) {
  state.localStream = stream;
}

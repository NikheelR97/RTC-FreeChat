

export const elements = {
  app: document.getElementById('app'),
  joinScreen: document.getElementById('join-screen'),
  joinForm: document.getElementById('join-form'),
  displayNameInput: document.getElementById('display-name-input'),

  // Drawers
  drawerLeft: document.getElementById('drawer-left'),
  drawerRight: document.getElementById('drawer-right'),
  currentUserAvatar: document.getElementById('current-user-avatar'),
  currentUserName: document.getElementById('current-user-name'),

  // Channels
  textChannelsList: document.getElementById('text-channels-list'),
  voiceChannelsList: document.getElementById('voice-channels-list'),
  createChannelBtn: document.getElementById('create-channel-btn'),
  createChannelModal: document.getElementById('create-channel-modal'),
  createChannelForm: document.getElementById('create-channel-form'),
  cancelChannelBtn: document.getElementById('cancel-channel-btn'),
  channelNameInput: document.getElementById('channel-name-input'),
  channelTypeSelect: document.getElementById('channel-type-select'),

  // Header
  currentChannelName: document.getElementById('current-channel-name'),
  menuButton: document.getElementById('menu-btn'),
  membersButton: document.getElementById('members-btn'),

  // Chat & Dock
  chatMessages: document.getElementById('chat-messages'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  chatFileInput: document.getElementById('chat-file-input'),
  fileButton: document.getElementById('file-button'),
  emojiButton: document.getElementById('emoji-button'),

  // Voice
  voicePanel: document.getElementById('voice-panel'),
  voiceChannelName: document.getElementById('voice-channel-name'),
  voiceDisconnectBtn: document.getElementById('voice-disconnect-btn'),
  muteButton: document.getElementById('mute-button'),
  cameraButton: document.getElementById('camera-button'),
  screenShareButton: document.getElementById('screen-share-button'),
  pttCheckbox: document.getElementById('ptt-checkbox'), // Missing in previous map but used in main.js

  // Members & Gallery
  membersList: document.getElementById('members-list'),
  // membersButton duplicate removed
  memberCount: document.getElementById('member-count'),

  // Gallery
  galleryDrawer: document.getElementById('drawer-gallery'),
  galleryGrid: document.getElementById('gallery-grid'),
  galleryToggleBtn: document.getElementById('toggle-gallery-btn'),
  closeGalleryBtn: document.getElementById('close-gallery-btn'),

  // Pickers
  emojiPicker: document.getElementById('emoji-picker'),
  emojiPickerContent: document.getElementById('emoji-picker-content'),
  emojiPickerTabs: document.getElementById('emoji-picker-tabs'),
  emojiSearchInput: document.getElementById('emoji-search-input'),
  gifButton: document.getElementById('gif-button'),
  gifPicker: document.getElementById('gif-picker'),
  gifPickerContent: document.getElementById('gif-picker-content'),
  gifSearchInput: document.getElementById('gif-search-input'),

  // Drag & Drop / Preview
  dropOverlay: document.getElementById('drop-overlay'),
  filePreviewArea: document.getElementById('file-preview-area'),
  previewImage: document.getElementById('preview-image'),
  previewFileIcon: document.getElementById('preview-file-icon'),
  previewFilename: document.getElementById('preview-filename'),
  removeFileBtn: document.getElementById('remove-file-btn'),

  // Misc
  themeToggle: document.getElementById('theme-toggle'),
  soundToggleBtn: document.getElementById('sound-toggle-btn'), // Dynamic
  typingIndicator: document.getElementById('typing-indicator'),

  // Threads
  drawerThread: document.getElementById('drawer-thread'),
  threadMessages: document.getElementById('thread-messages'),
  threadForm: document.getElementById('thread-form'),
  threadInput: document.getElementById('thread-input'),
  closeThreadBtn: document.getElementById('close-thread-btn'),
  logoutBtn: document.getElementById('logout-btn'),
};

# RTC FreeChat – Advanced VoIP & Text Rooms

RTC FreeChat is a feature-rich voice and text chat web application. It supports simultaneous voice and text channels, file uploads, emoji picker, GIF sharing, and works seamlessly on mobile devices. Built with WebRTC for audio and Socket.IO for real-time signaling.

> This is a learning / prototype app, demonstrating modern web app architecture.

## Features

### Core Features
- **Simultaneous Chat**: Join a voice channel while browsing text channels.
- **Voice & Text Channels**: Dedicated channels for different topics.
- **Sidebar Controls**: Persistent voice controls (Mute, PTT, Disconnect) in the sidebar.
- **Message Persistence**: Chat history (last 50 messages) is saved per channel.
- **WebRTC Audio**: Low-latency peer-to-peer voice chat.
- **Push-to-Talk**: Optional PTT mode holding Spacebar.

### Rich Messaging
- **File Uploads**: Share images and files in text chat with optional image compression.
- **Emoji Picker**: Native emoji picker with categories, search, and 8-column grid layout.
- **GIF Sharing**: Integrated Tenor GIF picker with trending and search functionality.
- **Typing Indicators**: See when other users are typing in real-time.

### UX Enhancements
- **Theme Toggle**: Switch between light and dark modes (persisted in localStorage).
- **Sound Effects**: Audio feedback for messages, user join/leave events.
- **Mobile Friendly**: Fully responsive UI with collapsible sidebars and touch-optimized controls.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)

## Install

```bash
npm install
```

## Run the app

### Development (auto-restart on changes)

```bash
npm run dev
```

### Production-style

```bash
npm start
```

By default the server starts on `http://localhost:3000`.

## Usage

1. Visit `http://localhost:3000` in your browser.
2. Enter a **Display Name** to join.
3. **Channels**:
   - Click a **#text-channel** to chat.
   - Click a **🔊 voice-channel** to join the conversation.
   - You can be in one text and one voice channel at the same time!
4. **Voice Controls**:
   - Use the panel at the bottom of the left sidebar to **Mute** or **Disconnect**.
   - Enable **Push-to-Talk** and hold **Spacebar** to speak.
5. **Rich Messaging**:
   - Click the **😀** button to open the emoji picker.
   - Click the **GIF** button to search and send GIFs.
   - Click the **📎** button to attach files.
6. **Theme**:
   - Click the **🌓** button in the sidebar header to toggle light/dark mode.
7. **Mobile**:
   - Use the hamburger menu (top left) to access channels.
   - Use the members icon (top right) to see who is online.

## Project Structure

The codebase is modular and organized for maintainability:

- **Backend** (`server/`)
  - `server.js`: Entry point, Express & Socket.IO setup.
  - `server/state/rooms.js`: In-memory state management for rooms/channels/users.
  - `server/socket/socketHandler.js`: Socket.IO event handlers.

- **Frontend** (`public/js/`)
  - `main.js`: Application entry point.
  - `ui.js`: DOM manipulation and UI updates.
  - `state.js`: Client-side state management.
  - `socket-client.js`: Socket.IO event logic.
  - `webrtc.js`: WebRTC peer connection logic.
  - `emoji.js`: Emoji picker with CDN integration.
  - `gif.js`: GIF picker with Tenor API integration.
  - `sounds.js`: Sound effect generation using Web Audio API.
  - `utils.js`: Utility functions (escaping, image compression, etc.).

## Notes & Limitations

- **Persistence**: Rooms and messages are stored in-memory and will reset if the server restarts.
- **Scaling**: Uses a full-mesh WebRTC topology; best for small to medium groups (up to ~10 users per voice channel).
- **GIF API**: Uses Tenor's public test API key for now

## TODO
- [ ] Add support for GIF API key
- [ ] Add support uploading files loading bar
- [ ] Add support for voice recording
- [ ] Add screen to view is in current voice channel
- [ ] Add support for screen sharing
- [ ] Add support for video chat
- [ ] Add support for photo/video recording
- [ ] Add support rich text commands like spoiler filter, redacted text, formatting stuff in text, code blocks, etc.
- [ ] File size limits

## Research
- [ ] Discord bot integration
- [ ] WebRTC screen sharing
- [ ] WebRTC video chat
- [ ] WebRTC photo/video recording

## Contributing

## License
MIT



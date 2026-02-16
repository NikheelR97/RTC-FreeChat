# RTC FreeChat – Advanced VoIP & Text Rooms

RTC FreeChat is a feature-rich voice and text chat web application. It supports simultaneous voice and text channels, file uploads, and works seamlessly on mobile devices. Built with WebRTC for audio and Socket.IO for real-time signaling.

> This is a learning / prototype app, demonstrating modern web app architecture.

## Features

- **Simultaneous Chat**: Join a voice channel while browsing text channels.
- **Voice & Text Channels**: dedicated channels for different topics.
- **Sidebar Controls**: Persistent voice controls (Mute, Deafen, Disconnect) in the sidebar.
- **File Uploads**: Share images and files in text chat.
- **Message Persistence**: Chat history (last 50 messages) is saved per channel.
- **Mobile Friendly**: Fully responsive UI with collapsible sidebars and touch-optimized controls.
- **WebRTC Audio**: Low-latency peer-to-peer voice chat.
- **Push-to-Talk**: Optional PTT mode holding Spacebar.

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

## usage

1. Visit `http://localhost:3000` in your browser.
2. Enter a **Display Name** to join.
3. **Channels**:
   - Click a **#text-channel** to chat.
   - Click a **🔊 voice-channel** to join the conversation.
   - You can be in one text and one voice channel at the same time!
4. **Voice Controls**:
   - Use the panel at the bottom of the left sidebar to **Mute** or **Disconnect**.
5. **Mobile**:
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

## Notes & Limitations

- **Persistence**: Rooms and messages are stored in-memory and will reset if the server restarts.
- **Scaling**: Uses a full-mesh WebRTC topology; best for small to medium groups (up to ~10 users per voice channel).

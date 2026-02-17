# RTC FreeChat Wiki v1.1 📘

Welcome to the **RTC FreeChat** documentation. This application is a modern, real-time communication platform built with the "Fluidverse" design philosophy. It emphasizes speed, privacy (P2P), and a rich visual experience without the bloat of heavy frameworks.

---

## 🌟 Key Features

### 💬 Real-Time Messaging & Threads

- **Instant Messaging**: Powered by Socket.io for low-latency delivery.
- **Threads**: Keep conversations organized by replying to specific messages in a side drawer.
- **Rich Media**: Drag & drop images and files. Images open in a custom Lightbox.
- **Reactions**: React to messages with emojis to express yourself quickly.

### 📞 Voice & Video

- **WebRTC Powered**: Peer-to-peer connections for high-quality, private calls.
- **Screen Sharing**: Share your screen instantly with other participants.
- **Dynamic Grid**: Video feeds automatically arrange themselves in a responsive grid.
- **Speaking Indicators**: Visual glow effects show who is currently talking.

### 🎨 Fluid UI/UX

- **Glassmorphism**: A sleek, dark-mode aesthetic with varying levels of transparency and blur.
- **Gestures**: Mobile-friendly swipe gestures to toggle sidebars.
- **Sound Effects**: Satisfying auditory feedback for interactions (toggleable).
- **Command Palette**: Quickly navigate channels using `Ctrl+K`.

---

## 🏗️ Architecture

RTC FreeChat is built on a **Vanilla JS + Node.js** stack to ensure maximum performance and understanding of core web technologies.

### Backend (`server.js`)

- **Express**: Serves static assets.
- **Socket.io**: Handles signaling for WebRTC, chat events, and user presence.
- **In-Memory State**: Currently stores temporary channel/user data (Phase 13 will add persistence).

### Frontend structure

The frontend code was recently refactored (Phase 10) for modularity:

| Module | Purpose |
| :--- | :--- |
| **`main.js`** | Entry point. Initializes socket, event listeners, and global setup. |
| **`state.js`** | Centralized state management (Store pattern). |
| **`ui.js`** | Aggregator file that exports all UI modules. |
| **`ui-core.js`** | DOM element references and shared utilities. |
| **`ui-chat.js`** | Chat rendering, message appending, and thread logic. |
| **`ui-drawers.js`** | Manages the left/right sidebars and gallery drawers. |
| **`ui-video.js`** | Handles the WebRTC video grid and stream rendering. |
| **`ui-components.js`** | Reusable UI bits like the Member List and Channel List. |
| **`socket-client.js`** | Client-side socket event handlers. |
| **`webrtc.js`** | Core WebRTC logic (PeerConnections, ICE candidates, Streams). |
| **`sounds.js`** | Web Audio API implementation for sound effects. |

---

## 📖 User Guide

### Getting Started

1. **Enter**: Type your Display Name and hit "Enter" on the splash screen.
2. **Navigation**:
    - **Left Sidebar**: Channel list (Text & Voice).
    - **Right Sidebar**: Member list (Online users).
3. **Joining a Channel**: Click any `# channel` to switch text rooms or `🔊 channel` to join a voice call.

### Using Media

- **Upload**: Drag files onto the chat area or use the `+` button.
- **Gallery**: Click the 🖼️ icon in the header to see a grid of all shared images in the channel.
- **Lightbox**: Click any image to view it in full resolution.

### Voice Controls

- **Mute**: Toggle your microphone.
- **Camera**: Toggle your video feed.
- **Screen Share**: Broadcast your screen.
- **Deafen**: Mute all incoming audio (via system volume).

---

## 🛠️ Development

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Tech Stack

- **Runtime**: Node.js
- **Transports**: WebSocket (Socket.io) & WebRTC
- **Styling**: Plain CSS3 (Variables, Flexbox, Grid)
- **Logic**: ES6+ JavaScript Modules

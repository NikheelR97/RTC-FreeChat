# RTC FreeChat – Simple VoIP Rooms

RTC FreeChat is a tiny Discord-style voice chat web app. Multiple users can join the same room ID and talk using WebRTC audio, with Socket.IO used for signaling.

> This is intended as a learning / prototype app, not a production-ready service.

## Features

- Audio-only WebRTC voice chat
- Simple room system (type a room ID and share it with friends)
- Mute / unmute, push-to-talk, and leave controls
- Presence list showing who is currently in the room
- Built-in text chat per room
- Modern, responsive UI

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

## Use it

1. Visit `http://localhost:3000` in your browser (Chrome or Edge recommended).
2. Allow microphone access when prompted.
3. Enter:
   - A **display name** (how you appear in the participant list).
   - A **room ID** (any short name, e.g. `study-group`).
4. Click **“Join voice room”**.
5. Share the same room ID with your friends so they can join.
6. Use:
   - **Mute / Unmute**: toggle your microphone on/off.
   - **Push-to-talk**: enable the checkbox, then **hold Space** while speaking.
   - **Leave**: exit the room (and close all peer connections).
7. Use the **Text chat** panel on the right to send messages to everyone in the room.

> Tip: Wear headphones to reduce echo and feedback.

## How it works (high level)

- **Backend** (`server.js`)
  - Express serves static files from `public/`.
  - Socket.IO manages:
    - `join-room` events and room membership.
    - WebRTC signaling messages: `webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`.
  - Rooms are stored in memory (no database), and cleared when empty.

- **Frontend** (`public/index.html`, `public/app.js`, `public/style.css`)
  - Joins a room via Socket.IO and requests microphone audio.
  - Uses `RTCPeerConnection` to build a mesh between all participants in a room.
  - Each remote participant gets its own hidden `<audio>` element that plays their stream.
  - The participant list shows who is in the room and whether you are muted.

## Notes & Limitations

- Rooms and users are **not persisted**; everything is in-memory.
- It uses a simple peer-to-peer mesh; many users in one room may not scale well.
- No authentication or user accounts are implemented.


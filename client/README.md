# Aether 🌌

**Aether** is a privacy-first, self-hosted communication platform designed to bridge the gap between the performance of desktop apps and the security of zero-knowledge architectures. It essentially functions as a "Private Discord" where YOU own the data.

![Aether UI](https://via.placeholder.com/800x450?text=Aether+Dashboard+Preview)

## 🚀 Key Features

### 🔒 Privacy & Security (Zero-Knowledge)

- **End-to-End Encryption (E2EE)**: Built on the **Signal Protocol** (Double Ratchet, X3DH). Messages are encrypted on your device and can only be read by the intended recipient.
- **Dual Encryption**: Sender visibility is achieved by encrypting outgoing messages for *both* the recipient and the sender's own other devices.
- **Self-Healing Identity**: Automated session management that detects and repairs corrupted cryptographic states.

### 🎙️ Real-Time Communication

- **Instant Messaging**: Powered by **Supabase Realtime** for sub-millisecond latency.
- **Voice Chat**: Peer-to-Peer audio streaming using **WebRTC** (Mesh Topology) and **Opus** codec.
- **Multi-Server Architecture**: Seamlessly switch between different "Guilds" (Servers) and Channels.

### 💻 Modern Tech Stack

- **Frontend**: React (TypeScript) + Vite + Tailwind CSS v4.
- **Backend Service**: Supabase (PostgreSQL, Auth, Realtime).
- **Desktop Runtime**: **Tauri** (Rust) - *In Progress*.
- **Compatibility**: Partial Discord Gateway emulation (Holo-Gateway) to support existing bots.

---

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18+)
- Rust (for Tauri build)
- Supabase Project (or local instance)

### Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/NikheelR97/RTC-FreeChat.git
    cd RTC-FreeChat
    ```

2. **Install Client Dependencies**

    ```bash
    cd client
    npm install
    ```

3. **Environment Setup**
    Create a `.env` file in the `client` directory:

    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4. **Run Development Server**

    ```bash
    npm run dev
    ```

---

## 🏗️ Architecture

```mermaid
graph TD
    User[User Client] -->|E2EE Encrypted Data| Supabase[Supabase DB]
    User -->|P2P Voice| Peer[Peer Client]
    Supabase -->|Realtime Events| User
    
    subgraph Client [Tauri / Browser]
        React[React UI]
        Signal[Signal Protocol Store]
        Local[LocalStorage (Keys)]
    end
    
    React --> Signal
    Signal --> Local
```

## 🤝 Contributing

This project is currently in **Alpha**.

- **Phase 1**: Blueprint & Architecture (Done)
- **Phase 2**: Core Infrastructure (Done)
- **Phase 3**: Client Development (Active)
- **Phase 4**: Mobile Port (Planned)

## 📄 License

MIT License. Built with ❤️ for the decentralized web.

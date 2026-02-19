const OpCodes = {
    DISPATCH: 0,
    HEARTBEAT: 1,
    IDENTIFY: 2,
    PRESENCE_UPDATE: 3,
    VOICE_STATE_UPDATE: 4,
    VOICE_SIGNAL: 5, // Custom OpCode for WebRTC Signaling
    RESUME: 6,
    RECONNECT: 7,
    REQUEST_GUILD_MEMBERS: 8,
    INVALID_SESSION: 9,
    HELLO: 10,
    HEARTBEAT_ACK: 11,
};

function handleMessage(gateway, ws, rawData) {
    let payload;
    try {
        payload = JSON.parse(rawData);
    } catch (e) {
        return console.error('[Holo] Invalid JSON:', e);
    }

    const { op, d, t } = payload;
    const { mockGuilds, mockUser } = require('../mock-data');

    switch (op) {
        case OpCodes.HEARTBEAT:
            console.log('[Holo] Heartbeat received');
            gateway.send(ws, { op: OpCodes.HEARTBEAT_ACK });
            break;

        case OpCodes.IDENTIFY:
            console.log('[Holo] Identify:', d.token);

            // Create unique user session for this connection (for testing P2P locally)
            const sessionUser = {
                ...mockUser,
                id: mockUser.id + '-' + Math.floor(Math.random() * 10000),
                username: `Orbit-${Math.floor(Math.random() * 100)}`
            };
            ws.userId = sessionUser.id;

            // Mock Ready Event
            gateway.send(ws, {
                op: OpCodes.DISPATCH,
                t: 'READY',
                d: {
                    v: 9,
                    user: sessionUser,
                    guilds: mockGuilds,
                    session_id: 'holo-session-' + Date.now(),
                    application: { id: 'app-aether' }
                }
            });
            break;

        case OpCodes.VOICE_STATE_UPDATE:
            // Broadcast voice join/leave to all clients
            console.log('[Holo] Voice State Update:', d);
            gateway.broadcast({
                op: 0, // Dispatch
                t: 'VOICE_STATE_UPDATE',
                d: d
            });
            break;

        case OpCodes.VOICE_SIGNAL:
            // Route WebRTC Signaling (Offer/Answer/ICE)
            // d should contain: { targetId, candidate, sdp, ... }
            console.log(`[Holo] Signal from ${ws.userId} to ${d.targetId}`);

            // Find target client (Simple iteration for prototype)
            let targetFound = false;
            gateway.clients.forEach(client => {
                if (client.userId === d.targetId && client.readyState === 1) {
                    gateway.send(client, {
                        op: OpCodes.VOICE_SIGNAL,
                        d: {
                            ...d,
                            senderId: ws.userId // Stamp sender ID so receiver knows who it is
                        }
                    });
                    targetFound = true;
                }
            });
            if (!targetFound) console.warn(`[Holo] Target ${d.targetId} not found.`);
            break;

        // Handle Mock Message Send (usually this is HTTP POST in Discord, but WS for Aether demo)
        case 0: // Mock Dispatch from Client
            if (t === 'MESSAGE_CREATE') {
                console.log('[Holo] Message:', d.content);

                const newMessage = {
                    ...d,
                    id: 'msg-' + Date.now(),
                    timestamp: new Date().toISOString(),
                    author: mockUser, // Mock author as the current user
                    mentions: [],
                    attachments: []
                };

                // Echo back to all clients (Broadcast)
                gateway.broadcast({
                    op: 0,
                    t: 'MESSAGE_CREATE',
                    d: newMessage
                });
            }
            break;

        default:
            console.log(`[Holo] Unhandled OpCode: ${op}`);
    }
}

module.exports = { handleMessage, OpCodes };

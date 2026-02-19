
const { WebSocketServer } = require('ws');
const { handleMessage } = require('./dispatcher');

class HoloGateway {
    constructor(server) {
        this.wss = new WebSocketServer({ server });
        this.clients = new Set();

        this.init();
    }

    init() {
        this.wss.on('connection', (ws) => {
            console.log('[Holo] Client Connected');
            this.clients.add(ws);

            // Opcode 10: Hello
            this.send(ws, {
                op: 10,
                d: { heartbeat_interval: 45000 }
            });

            ws.on('message', (data) => handleMessage(this, ws, data));
            ws.on('close', () => this.clients.delete(ws));
        });
    }

    send(ws, payload) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(payload));
        }
    }

    broadcast(payload) {
        this.clients.forEach(client => this.send(client, payload));
    }
}

module.exports = HoloGateway;

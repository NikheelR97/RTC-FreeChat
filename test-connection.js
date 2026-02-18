import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const JWT_SECRET = 'super-secret-key-change-in-production'; // Hardcoded for dev env as per server.js default
const token = jwt.sign({ id: 'test-user-id', username: 'TestUser' }, JWT_SECRET);

const socket = io('http://localhost:3000', {
    auth: { token }
});

const log = (msg) => {
    console.log(msg);
    fs.appendFileSync('test_output.txt', msg + '\n');
};

fs.writeFileSync('test_output.txt', 'Starting test...\n');

socket.on('connect', () => {
    log('Connected to server');
    socket.emit('join-room', { roomId: 'main', displayName: 'TestUser' });
});

socket.on('room-info', (data) => {
    log('Received room-info: ' + JSON.stringify(data, null, 2));
    setTimeout(() => process.exit(0), 100);
});

socket.on('connect_error', (err) => {
    log('Connection error: ' + err.message);
    setTimeout(() => process.exit(1), 100);
});

setTimeout(() => {
    log('Timeout - No room-info received');
    process.exit(1);
}, 5000);

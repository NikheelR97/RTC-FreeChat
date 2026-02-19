
// Basic Holo-Gateway Server
const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();
const HoloGateway = require('./src/gateway/server');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// HTTP Server
app.get('/', (req, res) => {
    res.send('Aether Holo-Gateway Online');
});

const server = http.createServer(app);

// Initialize Gateway
new HoloGateway(server);

server.listen(PORT, () => {
    console.log(`Holo-Gateway running on http://localhost:${PORT}`);
});

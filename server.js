const path = require('path');
const fs = require('fs');
/* eslint-disable no-console */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const setupSocketHandlers = require('./server/socket/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static frontend
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// File uploads for chat attachments
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '');
    cb(null, unique + ext);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

app.use('/uploads', express.static(uploadsDir));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileInfo = {
    url: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname || 'file',
    mimeType: req.file.mimetype || 'application/octet-stream',
    size: req.file.size,
  };

  res.json(fileInfo);
});

// Setup Socket.IO handlers
setupSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`RTC FreeChat server listening on http://localhost:${PORT}`);
});

import { getChannels } from '../database.js';

export const rooms = new Map();

export function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    // Initialize room with empty channels/users maps
    rooms.set(roomId, {
      channels: new Map(),
      users: new Map(),
    });

    // Populate channels from Database
    const dbChannels = getChannels();
    console.log('[Rooms] Loaded channels from DB:', dbChannels.length, dbChannels);
    const room = rooms.get(roomId);

    dbChannels.forEach((c) => {
      room.channels.set(c.id, {
        type: c.type,
        users: new Set(),
      });
    });
  }
  return rooms.get(roomId);
}

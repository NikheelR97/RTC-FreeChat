/**
 * Room and channel structure:
 * rooms: Map<roomId, { channels: Map<channelId, { type: 'text'|'voice', users: Set<socketId> }>, users: Map<socketId, displayName> }>
 */
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      channels: new Map(),
      users: new Map(),
    });
    // Create default channels
    const room = rooms.get(roomId);
    room.channels.set('general', { type: 'text', users: new Set(), messages: [] });
    room.channels.set('voice-1', { type: 'voice', users: new Set(), messages: [] });
  }
  return rooms.get(roomId);
}

module.exports = {
  rooms,
  getOrCreateRoom,
};

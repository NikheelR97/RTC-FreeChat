
// Initial "State of the Universe"
const mockGuilds = [
    {
        id: 'guild-1',
        name: 'Aether Core',
        icon: null,
        channels: [
            { id: 'chan-1', name: 'general', type: 0 },
            { id: 'chan-2', name: 'dev-log', type: 0 },
            { id: 'chan-3', name: 'voice-lounge', type: 2 }
        ]
    },
    {
        id: 'guild-2',
        name: 'Rustaceans',
        icon: null,
        channels: [
            { id: 'chan-4', name: 'cargo-cult', type: 0 }
        ]
    }
];

const mockUser = {
    id: 'user-1',
    username: 'Orbit',
    discriminator: '0001',
    avatar: null,
    bot: false,
};

module.exports = { mockGuilds, mockUser };

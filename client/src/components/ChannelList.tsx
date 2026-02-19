import { useGatewayStore } from '../stores/gateway';
import { Hash, Volume2, Mic, Headphones, PhoneOff, Lock, Plus, X } from 'lucide-react';
import { useState } from 'react';

export function ChannelList() {
    const {
        guilds,
        currentGuildId,
        currentChannelId,
        selectChannel,
        joinVoice,
        leaveVoice,
        activeVoiceChannelId,
        voicePeers,
        user,
        startDMByUsername
    } = useGatewayStore();

    const [showDMInput, setShowDMInput] = useState(false);
    const [dmTargetId, setDmTargetId] = useState('');

    const handleChannelClick = (channel: any) => {
        if (channel.type === 2) {
            if (activeVoiceChannelId === channel.id) return;
            joinVoice(channel.id);
        } else {
            selectChannel(channel.id);
        }
    };

    const handleStartDM = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dmTargetId.trim()) return;
        await startDMByUsername(dmTargetId.trim());
        setShowDMInput(false);
        setDmTargetId('');
    };

    // --- View 1: Home / DMs ---
    if (!currentGuildId) {
        // Aggregate DMs from all guilds (or a specific DM list if we had one, but currently they are mixed)
        // Filter to only show DMs where the CURRENT USER is a participant.
        const allDmChannels = guilds
            .flatMap(g => g.channels)
            .filter(c => (c.type === 1 || c.name.includes(':')) && (user?.id && c.name.includes(user.id)));

        // De-duplicate by ID just in case
        const uniqueDmChannels = Array.from(new Map(allDmChannels.map(c => [c.id, c])).values());

        const renderDMChannel = (channel: any) => {
            const isActive = activeVoiceChannelId === channel.id || currentChannelId === channel.id;
            let displayName = channel.name;
            if (user) {
                const parts = channel.name.split(':');
                const otherId = parts.find((id: string) => id !== user.id);
                if (otherId) displayName = `User ${otherId.slice(0, 4)}...`;
            }
            return (
                <div key={channel.id}
                    onClick={() => selectChannel(channel.id)}
                    className={`
                         flex items-center px-2 py-2 rounded-md cursor-pointer group transition-all
                         ${isActive ? 'bg-white/10 text-starlight' : 'text-dust hover:bg-white/5 hover:text-gray-200'}
                     `}
                >
                    <div className="w-8 h-8 rounded-full bg-cosmic mr-3 flex items-center justify-center text-xs text-starlight font-bold border border-starlight/10">
                        {displayName.slice(0, 2)}
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-sm ${isActive ? 'font-medium' : 'font-normal'} truncate`}>
                            {displayName}
                        </span>
                        <span className="text-[10px] text-dust/50">Private Message</span>
                    </div>
                </div>
            );
        };

        return (
            <div className="w-60 bg-cosmic/30 backdrop-blur-md flex flex-col border-r border-cosmic">
                {/* Home Header */}
                <div className="h-12 border-b border-cosmic flex items-center px-4 font-bold text-starlight tracking-wide shadow-sm">
                    Direct Messages
                </div>

                {/* DM List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {/* Start DM Input */}
                    <div className="px-2 mb-4 mt-2">
                        <button
                            onClick={() => setShowDMInput(!showDMInput)}
                            className="w-full text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded px-2 py-1.5 flex items-center justify-center gap-2 transition-colors"
                        >
                            <Plus className="w-3 h-3" /> Start Conversation
                        </button>
                    </div>

                    {showDMInput && (
                        <form onSubmit={handleStartDM} className="px-2 mb-4 relative">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Username..."
                                className="w-full bg-void/50 border border-cosmic rounded px-2 py-1.5 text-xs text-starlight placeholder-dust/50 focus:outline-none focus:border-nebula"
                                value={dmTargetId}
                                onChange={(e) => setDmTargetId(e.target.value)}
                            />
                        </form>
                    )}

                    <div className="space-y-0.5">
                        {uniqueDmChannels.length === 0 && !showDMInput && (
                            <div className="text-center text-dust/50 text-xs py-10">No messages yet.</div>
                        )}
                        {uniqueDmChannels.map(c => renderDMChannel(c))}
                    </div>
                </div>

                {/* User Bar */}
                <div className="h-14 bg-void/50 flex items-center px-3 gap-3 border-t border-cosmic shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-nebula to-starlight flex items-center justify-center text-void font-bold text-xs relative group cursor-pointer hover:shadow-lg hover:shadow-nebula/20 transition-all">
                        {user?.username.slice(0, 2).toUpperCase() || '??'}
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-void ${user ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="text-xs font-bold text-starlight truncate cursor-copy hover:text-nebula transition-colors" onClick={() => user && navigator.clipboard.writeText(user.id)} title="Click to copy ID">
                            {user?.username || 'Connecting...'}
                        </div>
                        <div className="text-[10px] text-dust opacity-70 truncate">{user?.id?.slice(0, 8) || '...'}...</div>
                    </div>
                    <div className="ml-auto flex gap-1">
                        <button className="p-1.5 hover:bg-white/10 rounded-md text-dust hover:text-starlight transition-colors"><Mic className="w-4 h-4" /></button>
                        <button className="p-1.5 hover:bg-white/10 rounded-md text-dust hover:text-starlight transition-colors"><Headphones className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
        );
    }

    // --- View 2: Guild Channels ---
    const guild = guilds.find(g => g.id === currentGuildId);
    if (!guild) return null;

    // Filter Channels
    const textChannels = guild.channels.filter(c => c.type === 0);
    const voiceChannels = guild.channels.filter(c => c.type === 2);
    // REMOVED: DMs from Guild View

    const renderChannel = (channel: any, icon: any) => {
        const isActive = activeVoiceChannelId === channel.id || currentChannelId === channel.id;

        return (
            <div key={channel.id}>
                <div
                    onClick={() => handleChannelClick(channel)}
                    className={`
                        flex items-center px-2 py-1.5 rounded-md cursor-pointer group transition-all
                        ${isActive ? 'bg-white/10 text-starlight' : 'text-dust hover:bg-white/5 hover:text-gray-200'}
                    `}
                >
                    {icon}
                    <span className={`text-sm ${isActive ? 'font-medium' : 'font-normal'} truncate`}>
                        {channel.name}
                    </span>
                </div>
                {/* Voice Users Logic */}
                {channel.type === 2 && isActive && (
                    <div className="pl-8 py-1 space-y-1">
                        <div className="flex items-center gap-2 group cursor-pointer">
                            <div className="w-5 h-5 rounded-full bg-nebula flex items-center justify-center text-[8px] text-void font-bold shadow-sm shadow-nebula/50">ME</div>
                            <span className="text-xs text-starlight font-medium">You</span>
                        </div>
                        {Object.keys(voicePeers).map(peerId => (
                            <div key={peerId} className="flex items-center gap-2 group cursor-pointer">
                                <div className="w-5 h-5 rounded-full bg-cosmic flex items-center justify-center text-[8px] text-starlight border border-starlight/20">ID</div>
                                <span className="text-xs text-dust group-hover:text-starlight transition-colors">User {peerId.slice(0, 4)}</span>
                                <audio autoPlay ref={(audio) => { if (audio && voicePeers[peerId]) audio.srcObject = voicePeers[peerId]; }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-60 bg-cosmic/30 backdrop-blur-md flex flex-col border-r border-cosmic">
            {/* Header */}
            <div className="h-12 border-b border-cosmic flex items-center px-4 font-bold text-starlight tracking-wide shadow-sm hover:bg-white/5 transition-colors cursor-pointer">
                {guild.name}
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4">

                {/* Section: Text Channels */}
                <div>
                    <div className="px-2 text-[10px] font-bold text-dust/70 uppercase tracking-widest mb-1 flex items-center">
                        Text Channels
                    </div>
                    <div className="space-y-0.5">
                        {textChannels.map(c => renderChannel(c, <Hash className="w-4 h-4 mr-2 opacity-50" />))}
                    </div>
                </div>

                {/* Section: Voice Channels */}
                <div>
                    <div className="px-2 text-[10px] font-bold text-dust/70 uppercase tracking-widest mb-1 flex items-center">
                        Voice Channels
                    </div>
                    <div className="space-y-0.5">
                        {voiceChannels.map(c => renderChannel(c, <Volume2 className="w-4 h-4 mr-2 opacity-50" />))}
                    </div>
                </div>
            </div>

            {/* Voice Status & User Bar (Preserved) */}
            {activeVoiceChannelId && (
                <div className="bg-void/80 border-t border-cosmic p-2">
                    <div className="flex items-center justify-between mb-1">
                        <div className="text-green-400 text-xs font-bold flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Voice Connected
                        </div>
                        <div className="text-[10px] text-dust/50 font-mono">WebRTC Mesh</div>
                    </div>
                    <div className="text-starlight text-sm font-medium truncate">
                        {guild.channels.find(c => c.id === activeVoiceChannelId)?.name || 'Unknown Channel'}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={() => leaveVoice()}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs py-1 rounded border border-red-500/20 transition-colors flex items-center justify-center gap-1"
                        >
                            <PhoneOff className="w-3 h-3" /> Disconnect
                        </button>
                    </div>
                </div>
            )}

            <div className="h-14 bg-void/50 flex items-center px-3 gap-3 border-t border-cosmic shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-nebula to-starlight flex items-center justify-center text-void font-bold text-xs relative group cursor-pointer hover:shadow-lg hover:shadow-nebula/20 transition-all">
                    {user?.username.slice(0, 2).toUpperCase() || '??'}
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-void ${user ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <div className="flex flex-col min-w-0">
                    {/* Copy ID on click */}
                    <div
                        className="text-xs font-bold text-starlight truncate cursor-copy hover:text-nebula transition-colors"
                        onClick={() => {
                            if (user) navigator.clipboard.writeText(user.id);
                        }}
                        title="Click to copy ID"
                    >
                        {user?.username || 'Connecting...'}
                    </div>
                    <div className="text-[10px] text-dust opacity-70 truncate" title={user?.id}>
                        {user?.id?.slice(0, 8) || '...'}...
                    </div>
                </div>
                <div className="ml-auto flex gap-1">
                    <button className="p-1.5 hover:bg-white/10 rounded-md text-dust hover:text-starlight transition-colors">
                        <Mic className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-white/10 rounded-md text-dust hover:text-starlight transition-colors">
                        <Headphones className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState, useRef, useEffect } from 'react';
import { useGatewayStore } from '../stores/gateway';
import { Send } from 'lucide-react';

export function ChatView() {
    const { messages, currentChannelId, guilds, currentGuildId, sendMessage, connected } = useGatewayStore();
    const [inputValue, setInputValue] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    // 1. Resolve Channel & Guild Context
    let channel = null;
    let guildName = '';

    if (currentGuildId) {
        const guild = guilds.find(g => g.id === currentGuildId);
        if (guild) {
            channel = guild.channels.find(c => c.id === currentChannelId);
            guildName = guild.name;
        }
    } else {
        for (const g of guilds) {
            const found = g.channels.find(c => c.id === currentChannelId);
            if (found) {
                channel = found;
                guildName = 'Direct Messages';
                break;
            }
        }
    }

    // 2. Prepare Data & Handlers (Hooks dependent or otherwise)
    const channelMessages = currentChannelId ? (messages[currentChannelId] || []) : [];

    // 3. Hooks (MUST be unconditional)
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [channelMessages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;
        sendMessage(inputValue);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // 4. Conditional Rendering (Returns)
    if (!connected) {
        return (
            <div className="flex-1 bg-void flex items-center justify-center flex-col gap-4">
                <div className="w-8 h-8 border-2 border-nebula border-t-transparent rounded-full animate-spin"></div>
                <div className="text-dust text-sm animate-pulse">Establishing Uplink...</div>
            </div>
        );
    }

    // Case: Guild Selected but not found (e.g. invalid ID)
    if (currentGuildId && !guilds.find(g => g.id === currentGuildId)) {
        return (
            <div className="flex-1 bg-void flex items-center justify-center flex-col gap-2">
                <div className="text-dust">System Not Found</div>
            </div>
        );
    }

    // Case: Home View (No Guild) and No DM Selected
    if (!currentGuildId && !currentChannelId) {
        return (
            <div className="flex-1 bg-void flex items-center justify-center flex-col gap-4 opacity-50">
                <div className="w-16 h-16 rounded-full bg-cosmic flex items-center justify-center text-4xl">🌌</div>
                <div className="text-dust font-medium">Select a conversation to start chatting</div>
            </div>
        );
    }

    // Case: Channel Not Found (or not yet loaded)
    if (!channel) {
        return (
            <div className="flex-1 bg-void flex items-center justify-center flex-col gap-2">
                <div className="text-dust">Channel Not Found</div>
            </div>
        );
    }

    // 5. Render Chat
    return (
        <div className="flex-1 bg-void relative flex flex-col min-w-0">
            {/* Header */}
            <div className="h-12 border-b border-cosmic flex items-center px-4 shadow-sm bg-void/80 backdrop-blur shrink-0 justify-between">
                <div className="flex items-center">
                    <span className="text-dust text-xl mr-2">#</span>
                    <span className="text-starlight font-bold truncate">{channel.name}</span>
                </div>
                <div className="text-xs text-dust/50 font-mono">E2EE: {channel.type === 1 || channel.name.includes(':') ? 'ON 🔒' : 'OFF'}</div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                {channelMessages.length === 0 && (
                    <div className="flex-1 flex items-end pb-10 opacity-30">
                        <div>
                            <div className="text-4xl font-bold text-starlight mb-2">Welcome to #{channel.name}!</div>
                            <div className="text-dust">This is the start of the <span className="text-nebula">{guildName || 'Private'}</span> server.</div>
                        </div>
                    </div>
                )}

                {channelMessages.map((msg) => (
                    <div key={msg.id || Math.random()} className="flex gap-4 group hover:bg-white/5 p-2 rounded -mx-2 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-cosmic mt-1 flex-shrink-0 flex items-center justify-center text-xl overflow-hidden">
                            {msg.author?.avatar_url ? <img src={msg.author.avatar_url} alt={msg.author.username} /> : '👤'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-starlight font-medium text-sm hover:underline cursor-pointer">{msg.author?.username || 'Unknown'}</span>
                                <span className="text-[10px] text-dust opacity-50">{new Date(msg.created_at || Date.now()).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap break-words">
                                {msg.content}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 pt-0 shrink-0">
                <div className="bg-cosmic/50 rounded-lg p-2 flex items-center border border-cosmic hover:border-nebula/50 transition-colors focus-within:border-nebula focus-within:ring-1 focus-within:ring-nebula/30">
                    <button className="w-8 h-8 rounded-full bg-white/10 text-dust hover:text-starlight flex items-center justify-center mr-2 shrink-0 transition-colors">
                        +
                    </button>
                    <input
                        className="bg-transparent flex-1 outline-none text-starlight placeholder-dust/30 text-sm min-w-0"
                        placeholder={`Message #${channel.name}`}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        onClick={handleSend}
                        className="ml-2 w-8 h-8 flex items-center justify-center text-nebula hover:bg-nebula/20 rounded-md transition-colors">
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { WebRTCManager } from '../lib/webrtc';
import { E2EEManager } from '../lib/e2ee';

// Types mimicking Discord/Supabase structure
interface User {
    id: string;
    username: string;
    avatar_url: string | null;
}

interface Channel {
    id: string;
    guild_id: string;
    name: string;
    type: 0 | 2; // 0=Text, 2=Voice
}

interface Guild {
    id: string;
    name: string;
    icon_url: string | null;
    channels: Channel[];
}

interface Message {
    id: string;
    channel_id: string;
    user_id: string;
    content: string;
    created_at: string;
    author?: User;
}

interface GatewayState {
    connected: boolean;
    user: User | null;
    guilds: Guild[];
    messages: Record<string, Message[]>; // channelId -> messages
    currentGuildId: string | null;
    currentChannelId: string | null;

    connect: () => Promise<void>;
    selectGuild: (guildId: string | null) => void;
    selectChannel: (channelId: string) => void;
    sendMessage: (content: string) => Promise<void>;

    // Voice
    activeVoiceChannelId: string | null;
    voicePeers: Record<string, MediaStream>;
    joinVoice: (channelId: string) => void;
    leaveVoice: () => void;

    // E2EE / DMs
    getPeerKeys: (userId: string) => Promise<any>;
    startDM: (targetUserId: string) => Promise<void>;
    startDMByUsername: (username: string) => Promise<void>;
}

// WebRTC & E2EE Manager Instances (Module Level)
let rtcManager: WebRTCManager | null = null;
let e2eeManager: E2EEManager | null = null;

export const useGatewayStore = create<GatewayState>((set, get) => ({
    connected: false,
    user: null,
    guilds: [],
    currentGuildId: null,
    currentChannelId: null,
    messages: {},

    // Voice
    activeVoiceChannelId: null,
    voicePeers: {},

    connect: async () => {
        if (get().connected) return;

        // 1. Auth
        const { data: { session } } = await supabase.auth.getSession();
        let currentUser = session?.user;

        if (!currentUser) {
            console.log('[Supabase] No session. Waiting for login UI.');
            return;
        }

        // Fetch Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profile) {
            set({
                user: { id: profile.id, username: profile.username, avatar_url: profile.avatar_url },
                connected: true
            });

            // --- Initialize E2EE ---
            e2eeManager = new E2EEManager(profile.id);
            const publicBundle = await e2eeManager.initialize();

            // Upload Keys (Upsert)
            const { error: keyError } = await supabase
                .from('user_keys')
                .upsert({
                    user_id: profile.id,
                    ...publicBundle
                });

            if (keyError) console.error('[E2EE] Failed to upload keys:', keyError);
            else console.log('[E2EE] Keys uploaded successfully');
        }

        // 2. Load Guilds & Channels
        const { data: guildsData, error: guildsError } = await supabase
            .from('guilds')
            .select('*, channels(*)');

        if (guildsError) {
            console.error('[Supabase] Failed to fetch guilds:', guildsError);
        } else if (guildsData) {
            // Transform to match interface if needed (Supabase returns simpler structure)
            const formattedGuilds: Guild[] = guildsData.map(g => ({
                id: g.id,
                name: g.name,
                icon_url: g.icon_url,
                channels: g.channels.map((c: any) => ({
                    id: c.id,
                    guild_id: c.guild_id,
                    name: c.name,
                    type: c.type
                })).sort((a: Channel, b: Channel) => a.type - b.type) // Text (0) before Voice (2)
            }));

            set({ guilds: formattedGuilds });

            // Select Default (First Guild, First Channel)
            if (formattedGuilds.length > 0) {
                const firstGuild = formattedGuilds[0];
                const firstChannel = firstGuild.channels[0];
                set({
                    currentGuildId: firstGuild.id,
                    currentChannelId: firstChannel ? firstChannel.id : null
                });
                if (firstChannel) {
                    get().selectChannel(firstChannel.id);
                }
            }
        }

        // 3. Subscribe to Messages (Realtime)
        supabase.channel('room-1')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                async (payload) => {
                    const newMessage = payload.new as any;
                    let content = newMessage.content;

                    // Ignore own messages to preserve Local Echo (plaintext)
                    // If we process our own message here, we can't decrypt it (as we didn't encrypt for self),
                    // so it would overwrite our nice plaintext local echo with "🔒 You sent...".
                    if (newMessage.user_id === get().user?.id) {
                        return;
                    }

                    // Decryption Check
                    try {
                        if (content.startsWith('{') && content.includes('"e2ee":true')) {
                            const json = JSON.parse(content);
                            if (e2eeManager) {
                                let targetCipher = json;

                                // Check for Dual Encryption format
                                if (json.dual) {
                                    // If I am the author (e.g. from another tab), use 'sender' payload
                                    if (newMessage.user_id === get().user?.id) {
                                        targetCipher = json.sender;
                                    } else {
                                        targetCipher = json.recipient;
                                    }
                                }

                                if (targetCipher) {
                                    content = await e2eeManager.decryptMessage(newMessage.user_id, targetCipher);
                                }
                            } else {
                                content = "🔒 Encrypted Message (Key Unavailable)";
                            }
                        }
                    } catch (err) {
                        console.error('[E2EE] Realtime Decrypt Error:', err);
                        content = "🔒 Decryption Error";
                    }

                    // Fetch author info (naive, should cache)
                    const { data: authorProfile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', newMessage.user_id)
                        .single();

                    const messageWithAuthor: Message = {
                        id: newMessage.id,
                        channel_id: newMessage.channel_id,
                        user_id: newMessage.user_id,
                        content: content,
                        created_at: newMessage.created_at,
                        author: authorProfile || { id: 'unknown', username: 'Unknown', avatar_url: null }
                    };

                    set((state) => ({
                        messages: {
                            ...state.messages,
                            [newMessage.channel_id]: [...(state.messages[newMessage.channel_id] || []), messageWithAuthor]
                        }
                    }));
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Supabase] Realtime Connected');
                    set({ connected: true });
                }
            });
    },

    // Helper: Fetch Peer Keys
    getPeerKeys: async (userId: string) => {
        const { data, error } = await supabase
            .from('user_keys')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error || !data) {
            console.log(`[Gateway] No keys found for ${userId}`, error);
            return null;
        }
        console.log(`[Gateway] Keys fetched for ${userId}:`, data);
        return data;
    },

    // Start DM by Username (Convenience wrapper)
    startDMByUsername: async (username: string) => {
        // Resolve Username -> UUID
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (error || !data) {
            console.error('[Gateway] User not found:', username);
            alert('User not found!'); // Simple feedback
            return;
        }

        await get().startDM(data.id);
    },

    // Start a Secure DM (Simplified: Create a channel with type 1)
    startDM: async (targetUserId: string) => {
        const { user } = get();
        if (!user) return;

        // Check availability of keys first
        const keys = await get().getPeerKeys(targetUserId);
        if (!keys) {
            console.error('[E2EE] Cannot start DM: Peer has no keys uploaded.');
            return;
        }

        // Create DM Channel (or fetch existing)
        // For simplicity, we create a new channel with a deterministic name "dm-id1-id2"
        const dmName = [user.id, targetUserId].sort().join(':');

        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .eq('name', dmName)
            .single();

        let channelId;
        if (data) {
            channelId = data.id;
        } else {
            // Create it (Requires a guild usually, but we'll put it in a "DM Guild" or just null guild if schema allows)
            // Schema requires guild_id. We'll hack it into the FIRST guild found for now or a system guild.
            // Better: Let's just assume we are in a guild and create a PRIVATE channel.
            const firstGuild = get().guilds[0];
            if (!firstGuild) return;

            const { data: newChannel } = await supabase
                .from('channels')
                .insert({
                    guild_id: firstGuild.id,
                    name: dmName,
                    type: 1 // 1 = DM / Private
                })
                .select()
                .single();
            if (newChannel) channelId = newChannel.id;
        }

        if (channelId) {
            get().selectChannel(channelId);
        }
    },

    sendMessage: async (content: string) => {
        const { currentChannelId, user, guilds } = get();
        if (!currentChannelId || !user) return;

        // Optimistic Update (Local Echo) - Show immediately!
        const tempId = 'temp-' + Date.now();
        const localMessage: Message = {
            id: tempId,
            channel_id: currentChannelId,
            user_id: user.id,
            content: content,
            created_at: new Date().toISOString(),
            author: user
        };

        set(state => ({
            messages: {
                ...state.messages,
                [currentChannelId]: [...(state.messages[currentChannelId] || []), localMessage]
            }
        }));

        let finalContent = content;
        let isEncrypted = false;

        // Check Channel Type
        // We need to find the channel object to check its type
        let channelType = 0;
        // Naively search all guilds
        for (const g of guilds) {
            const c = g.channels.find(ch => ch.id === currentChannelId);
            if (c) {
                channelType = c.type;

                // If DM (Type 1), Encrypt!
                if (channelType === 1 || c.name.includes(':')) {
                    // Extract Recipient ID from name "id1:id2"
                    const parts = c.name.split(':');
                    const recipientId = parts.find(id => id !== user.id);

                    if (recipientId && e2eeManager) {
                        console.log('[E2EE] Encrypting for', recipientId, 'and self', user.id);

                        let cipherRecipient;
                        let cipherSelf;

                        try {
                            // 1. Encrypt for Recipient
                            cipherRecipient = await e2eeManager.encryptMessage(
                                recipientId,
                                content,
                                () => get().getPeerKeys(recipientId) // Fetcher
                            );
                        } catch (err) {
                            console.error('[E2EE] Failed to encrypt for RECIPIENT:', err);
                            alert(`Encryption failed: The recipient (${recipientId}) has no keys. They must log in once.`);
                            // cleanup local echo
                            set(state => ({
                                messages: {
                                    ...state.messages,
                                    [currentChannelId]: state.messages[currentChannelId]?.filter(m => m.id !== tempId) || []
                                }
                            }));
                            return;
                        }

                        try {
                            // 2. Encrypt for Self
                            cipherSelf = await e2eeManager.encryptMessage(
                                user.id,
                                content,
                                () => get().getPeerKeys(user.id) // Fetcher for self keys
                            );
                        } catch (err: any) {
                            console.error('[E2EE] Failed to encrypt for SELF:', err);
                            alert(`Encryption failed (Self): ${err.message || err}. Try reloading.`);
                            // cleanup local echo
                            set(state => ({
                                messages: {
                                    ...state.messages,
                                    [currentChannelId]: state.messages[currentChannelId]?.filter(m => m.id !== tempId) || []
                                }
                            }));
                            return;
                        }

                        // Store as JSON string with BOTH chunks
                        finalContent = JSON.stringify({
                            e2ee: true,
                            dual: true,
                            recipient: cipherRecipient,
                            sender: cipherSelf
                        });
                        isEncrypted = true;
                    }
                }
                break;
            }
        }



        const { error } = await supabase
            .from('messages')
            .insert({
                content: finalContent,
                channel_id: currentChannelId,
                user_id: user.id
            });

        if (error) {
            console.error('[Supabase] Send Error:', error);
            // TODO: Remove local message or mark as error
        }
    },

    selectGuild: (guildId) => {
        set({ currentGuildId: guildId });
    },

    selectChannel: async (channelId) => {
        set({ currentChannelId: channelId });
        // Fetch history
        const { data, error } = await supabase
            .from('messages')
            .select('*, author:profiles(*)') // Join profiles
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[Gateway] Failed to fetch channel history:', error);
            return;
        }

        if (data) {
            const decryptedMessages = await Promise.all(data.map(async (msg) => {
                let content = msg.content;
                // Try Decrypt
                if (content && content.startsWith('{') && content.includes('"e2ee":true')) {
                    try {
                        const json = JSON.parse(content);
                        if (e2eeManager) {
                            let targetCipher = json;

                            // Check for Dual Encryption format
                            if (json.dual) {
                                // If I am the author, use 'sender' payload. If I am recipient, use 'recipient'.
                                if (msg.user_id === get().user?.id) {
                                    targetCipher = json.sender;
                                } else {
                                    targetCipher = json.recipient;
                                }
                            }

                            if (targetCipher) {
                                content = await e2eeManager.decryptMessage(msg.user_id, targetCipher);
                            } else {
                                content = "🔒 Format Error";
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to decrypt history msg:', msg.id, e);
                        content = "🔒 Decryption Failed";
                    }
                }
                return {
                    id: msg.id,
                    channel_id: msg.channel_id,
                    user_id: msg.user_id,
                    content: content,
                    created_at: msg.created_at,
                    author: msg.author as any
                };
            }));

            set(state => ({
                messages: {
                    ...state.messages,
                    [channelId]: decryptedMessages
                }
            }));
        }
    },

    joinVoice: (channelId) => {
        const { user } = get();
        if (!user) return;

        rtcManager = new WebRTCManager(
            (signal) => {
                supabase.channel('voice-signaling').send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { ...signal, senderId: user.id }
                });
            },
            (userId, stream) => {
                set(state => ({
                    voicePeers: { ...state.voicePeers, [userId]: stream }
                }));
            }
        );
        rtcManager.getLocalStream();
        set({ activeVoiceChannelId: channelId });

        // Listen for signals
        supabase.channel('voice-signaling')
            .on('broadcast', { event: 'signal' }, (payload) => {
                if (rtcManager && payload.payload.targetId === user.id) {
                    rtcManager.handleSignal(payload.payload);
                }
            })
            .subscribe();
    },

    leaveVoice: () => {
        if (rtcManager) {
            rtcManager.leave();
            rtcManager = null;
        }
        set({ activeVoiceChannelId: null, voicePeers: {} });
    }
}));

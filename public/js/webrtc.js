import { state } from './state.js';
import { rtcConfig } from './constants.js';
import { elements, updateVoicePanel } from './ui.js';

export async function ensureLocalStream() {
    if (state.localStream) return state.localStream;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        state.localStream = stream;
        // Apply mute state
        state.localStream.getAudioTracks().forEach((track) => {
            track.enabled = !state.isMuted;
        });
        return stream;
    } catch (err) {
        console.error('Error getting microphone:', err);
        alert('Could not access microphone. Please check permissions.');
        throw err;
    }
}

export function createPeerConnection(peerId, remoteDisplayName, shouldInitiate) {
    if (state.peerConnections.has(peerId)) {
        return state.peerConnections.get(peerId);
    }

    const pc = new RTCPeerConnection(rtcConfig);
    state.peerConnections.set(peerId, pc);

    if (state.localStream) {
        state.localStream.getTracks().forEach((track) => {
            const sender = pc.addTrack(track, state.localStream);
            const params = sender.getParameters();
            if (!params.encodings) {
                params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 40000;
            sender.setParameters(params).catch((err) => console.warn('Error setting params', err));
        });
    }

    pc.onicecandidate = (event) => {
        if (event.candidate && state.socket) {
            state.socket.emit('webrtc-ice-candidate', {
                targetId: peerId,
                candidate: event.candidate
            });
        }
    };

    pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        let audioEl = state.peerAudioElements.get(peerId);
        if (!audioEl) {
            audioEl = new Audio();
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            state.peerAudioElements.set(peerId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        updateVoicePanel();
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            cleanupPeer(peerId);
        }
    };

    if (shouldInitiate && state.socket) {
        (async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                state.socket.emit('webrtc-offer', {
                    targetId: peerId,
                    offer
                });
            } catch (err) {
                console.error('Error creating offer:', err);
            }
        })();
    }

    return pc;
}

export function cleanupPeer(peerId) {
    const pc = state.peerConnections.get(peerId);
    if (pc) {
        pc.close();
        state.peerConnections.delete(peerId);
    }
    const audioEl = state.peerAudioElements.get(peerId);
    if (audioEl) {
        audioEl.srcObject = null;
        audioEl.remove();
        state.peerAudioElements.delete(peerId);
    }
    state.remoteParticipants.delete(peerId);
    updateVoicePanel();
}

export function cleanupAllPeers() {
    Array.from(state.peerConnections.keys()).forEach((peerId) => cleanupPeer(peerId));
}

export function joinVoiceChannel() {
    if (!state.currentVoiceChannelId) return;
    state.remoteParticipants.clear();
    updateVoicePanel();
    // setStatus('Connecting...'); // UI update
}

export function leaveVoiceChannel() {
    cleanupAllPeers();
    if (state.localStream) {
        state.localStream.getTracks().forEach((t) => (t.enabled = true));
    }
    state.isMuted = false;
    state.remoteParticipants.clear();
    updateVoicePanel();
}

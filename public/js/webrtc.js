import { state } from './state.js';
import { rtcConfig } from './constants.js';
import { elements, updateVoicePanel, renderVideo, removeVideo, setSpeaking } from './ui.js';

let audioContext;
const analysers = new Map(); // peerId -> AnalyserNode
const speakingThreshold = -50; // dB
let checkSpeakingInterval;

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        startSpeakingLoop();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function startSpeakingLoop() {
    if (checkSpeakingInterval) clearInterval(checkSpeakingInterval);
    checkSpeakingInterval = setInterval(() => {
        analysers.forEach((analyser, peerId) => {
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);

            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;

            // Normalize somewhat (0-255 range usually)
            // Empirical threshold check
            const isSpeaking = average > 10; // Threshold needs tuning? 10/255 is quite low but good for sensitivity

            setSpeaking(peerId, isSpeaking);
        });
    }, 100); // Check every 100ms
}

function attachAnalyser(peerId, stream) {
    initAudioContext();
    if (!stream.getAudioTracks().length) return;

    try {
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analysers.set(peerId, analyser);
    } catch (e) {
        console.warn('AudioContext error for peer', peerId, e);
    }
}

function detachAnalyser(peerId) {
    if (analysers.has(peerId)) {
        analysers.delete(peerId);
        setSpeaking(peerId, false);
    }
}


export async function ensureLocalStream(video = false) {
    // If we already have a stream and the video preference hasn't changed, return it
    if (state.localStream) {
        const hasVideo = state.localStream.getVideoTracks().length > 0;
        if (hasVideo === video) return state.localStream;

        // If preference changed, stop old tracks and get new stream
        state.localStream.getTracks().forEach(t => t.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: video ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } : false
        });

        state.localStream = stream;
        state.isVideoEnabled = video;

        // Apply mute state
        state.localStream.getAudioTracks().forEach((track) => {
            track.enabled = !state.isMuted;
        });

        // If we are already connected, we need to replace tracks for all peers
        replaceTracksForPeers(stream);

        // Render local video if enabled
        if (video) {
            renderVideo('local', stream, true);
        } else {
            removeVideo('local');
        }

        // Monitor local audio for speaking indication
        attachAnalyser('local', stream);

        return stream;
    } catch (err) {
        console.error('Error getting media:', err);
        if (video) {
            alert('Could not access camera/microphone. Falling back to audio only.');
            return ensureLocalStream(false);
        }
        alert('Could not access microphone. Please check permissions.');
        throw err;
    }
}

function replaceTracksForPeers(newStream) {
    state.peerConnections.forEach((pc, peerId) => {
        // Simple approach: Replace track if kind matches, else addTransceiver/renegotiate
        // For this prototype, let's try removing all tracks and re-adding, triggering renegotiation

        const senders = pc.getSenders();
        senders.forEach((sender) => pc.removeTrack(sender));

        newStream.getTracks().forEach((track) => {
            pc.addTrack(track, newStream);
        });

        // Force renegotiation for the specific peer
        // We need to be the initiator again or send an update offer
        // In a perfect world we check `signalingState`, but here we can try creating a new offer

        pc.createOffer().then((offer) => {
            return pc.setLocalDescription(offer);
        }).then(() => {
            state.socket.emit('webrtc-offer', {
                targetId: peerId,
                offer: pc.localDescription
            });
        }).catch(err => console.error('Renegotiation error:', err));
    });
}

export async function toggleVideo() {
    const newVideoState = !state.isVideoEnabled;
    await ensureLocalStream(newVideoState);
    return newVideoState;
}

export async function startScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true // System audio
        });

        state.screenStream = stream;
        state.isScreenSharing = true;

        // Render local screen share preview
        renderVideo('screen-local', stream, true);

        // Replace tracks for peers (or add them)
        // This simplistic approach might need a full re-connection for stability in a basic implementation
        replaceTracksForPeers(stream);

        stream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };

        return true;
    } catch (err) {
        console.error('Error sharing screen:', err);
        return false;
    }
}

export function stopScreenShare() {
    if (state.screenStream) {
        state.screenStream.getTracks().forEach(t => t.stop());
        state.screenStream = null;
    }
    state.isScreenSharing = false;
    removeVideo('screen-local');

    // Revert to local camera/audio stream
    ensureLocalStream(state.isVideoEnabled);
}

export function createPeerConnection(peerId, remoteDisplayName, shouldInitiate) {
    if (state.peerConnections.has(peerId)) {
        return state.peerConnections.get(peerId);
    }

    const pc = new RTCPeerConnection(rtcConfig);
    state.peerConnections.set(peerId, pc);

    if (state.localStream) {
        state.localStream.getTracks().forEach((track) => {
            pc.addTrack(track, state.localStream);
        });
    }

    // Also add screen share tracks if active
    if (state.screenStream) {
        state.screenStream.getTracks().forEach((track) => {
            pc.addTrack(track, state.screenStream);
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

        // Distinguish based on track kind
        if (event.track.kind === 'video') {
            renderVideo(peerId, remoteStream);
        } else if (event.track.kind === 'audio') {
            let audioEl = state.peerAudioElements.get(peerId);
            if (!audioEl) {
                audioEl = new Audio();
                audioEl.autoplay = true;
                audioEl.playsInline = true;
                state.peerAudioElements.set(peerId, audioEl);
            }
            audioEl.srcObject = remoteStream;
            // Also ensure we render a "video card" even if it's just audio, for the UI
            renderVideo(peerId, remoteStream);

            // Monitor remote audio
            attachAnalyser(peerId, remoteStream);
        }

        // Check initial state
        const hasVideo = remoteStream.getVideoTracks().length > 0;
        import('./ui.js').then(ui => ui.setVideoVisible(peerId, hasVideo));

        // Handle track removal/muting to clean up video
        event.track.onmute = () => checkPeerVideoStatus(peerId, pc);
        event.track.onended = () => checkPeerVideoStatus(peerId, pc);

        updateVoicePanel();
    };

    pc.onnegotiationneeded = async () => {
        if (shouldInitiate) { // Only the polite peer (initiator) should restart negotiation?
            // actually, usually the one who added tracks
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                state.socket.emit('webrtc-offer', {
                    targetId: peerId,
                    offer
                });
            } catch (err) {
                console.error('Error renegotiating:', err);
            }
        }
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

    removeVideo(peerId);
    detachAnalyser(peerId);

    state.remoteParticipants.delete(peerId);
    updateVoicePanel();
}

function checkPeerVideoStatus(peerId, pc) {
    const receivers = pc.getReceivers();
    const hasActiveVideo = receivers.some(r => r.track.kind === 'video' && !r.track.muted && r.track.readyState === 'live');

    import('./ui.js').then(ui => ui.setVideoVisible(peerId, hasActiveVideo));
}

export function cleanupAllPeers() {
    Array.from(state.peerConnections.keys()).forEach((peerId) => cleanupPeer(peerId));
}

export function joinVoiceChannel() {
    if (!state.currentVoiceChannelId) return;
    state.remoteParticipants.clear();
    updateVoicePanel();
}

export function leaveVoiceChannel() {
    cleanupAllPeers();
    if (state.localStream) {
        state.localStream.getTracks().forEach((t) => t.stop()); // Fully stop
        state.localStream = null;
    }
    if (state.screenStream) {
        state.screenStream.getTracks().forEach(t => t.stop());
        state.screenStream = null;
    }
    state.isMuted = false;
    state.isVideoEnabled = false;
    state.isScreenSharing = false;

    removeVideo('local');
    removeVideo('screen-local');

    // Stop monitoring
    detachAnalyser('local');
    analysers.forEach((_, key) => detachAnalyser(key));
    if (checkSpeakingInterval) clearInterval(checkSpeakingInterval);
    if (audioContext) audioContext.close().then(() => audioContext = null);

    state.remoteParticipants.clear();
    updateVoicePanel();
}

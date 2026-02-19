export interface SignalData {
    targetId: string;
    type: 'offer' | 'answer' | 'ice';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    senderId?: string;
}

export class WebRTCManager {
    localStream: MediaStream | null = null;
    peers: Map<string, RTCPeerConnection> = new Map();
    onSignal: (data: SignalData) => void;
    onStream: (userId: string, stream: MediaStream) => void;

    constructor(onSignal: (data: SignalData) => void, onStream: (userId: string, stream: MediaStream) => void) {
        this.onSignal = onSignal;
        this.onStream = onStream;
    }

    async getLocalStream() {
        if (this.localStream) return this.localStream;
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            return this.localStream;
        } catch (error) {
            console.error('Failed to get local stream', error);
            throw error;
        }
    }

    createPeer(targetId: string, initiator: boolean) {
        if (this.peers.has(targetId)) return this.peers.get(targetId)!;

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peers.set(targetId, pc);

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream!));
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.onSignal({
                    targetId,
                    type: 'ice',
                    candidate: event.candidate.toJSON()
                });
            }
        };

        // Handle remote streams
        pc.ontrack = (event) => {
            console.log(`Received track from ${targetId}`);
            this.onStream(targetId, event.streams[0]);
        };

        // Create Offer if initiator (the one who just joined or started)
        if (initiator) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                this.onSignal({
                    targetId,
                    type: 'offer',
                    sdp: offer
                });
            });
        }

        return pc;
    }

    async handleSignal(data: SignalData) {
        const { senderId, type, sdp, candidate } = data;
        if (!senderId) return;

        let pc = this.peers.get(senderId);
        if (!pc) {
            pc = this.createPeer(senderId, false);
        }

        try {
            if (type === 'offer' && sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                this.onSignal({
                    targetId: senderId,
                    type: 'answer',
                    sdp: answer
                });
            } else if (type === 'answer' && sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            } else if (type === 'ice' && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (err) {
            console.error('Error handling signal', err);
        }
    }

    leave() {
        this.peers.forEach(pc => pc.close());
        this.peers.clear();
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }
}

// WebRTC Voice Chat Service
// Uses Firebase Realtime Database for signaling

import { getDatabase, ref, set, onValue, push, remove, onChildAdded, onChildRemoved, off, Database } from 'firebase/database';

// Lazy initialization of database to avoid issues if Firebase not yet initialized
let database: Database | null = null;
const getDb = (): Database => {
    if (!database) {
        database = getDatabase();
    }
    return database;
};

// STUN servers for NAT traversal
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

interface VoiceChatCallbacks {
    onRemoteStream: (odedUserId: string, stream: MediaStream) => void;
    onUserLeft: (odedUserId: string) => void;
    onError: (error: Error) => void;
}

export class VoiceChatService {
    private roomId: string;
    private odedUserId: string;
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private callbacks: VoiceChatCallbacks;
    private isMuted: boolean = false;

    constructor(roomId: string, odedUserId: string, callbacks: VoiceChatCallbacks) {
        this.roomId = roomId;
        this.odedUserId = odedUserId;
        this.callbacks = callbacks;
    }

    // Initialize local audio stream
    async initialize(): Promise<MediaStream> {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            return this.localStream;
        } catch (error) {
            throw new Error('마이???�근 권한???�요?�니??');
        }
    }

    // Join voice chat room
    async join(): Promise<void> {
        if (!this.localStream) {
            await this.initialize();
        }

        // Register user in voice chat room
        const userRef = ref(getDb(), `voiceChat/${this.roomId}/users/${this.odedUserId}`);
        await set(userRef, {
            odedUserId: this.odedUserId,
            joinedAt: Date.now(),
        });

        // Listen for other users
        this.listenForUsers();

        // Listen for offers
        this.listenForOffers();

        // Listen for answers
        this.listenForAnswers();

        // Listen for ICE candidates
        this.listenForIceCandidates();
    }

    // Leave voice chat
    async leave(): Promise<void> {
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close all peer connections
        this.peerConnections.forEach((pc, odedUserId) => {
            pc.close();
        });
        this.peerConnections.clear();

        // Remove user from voice chat room
        const userRef = ref(getDb(), `voiceChat/${this.roomId}/users/${this.odedUserId}`);
        await remove(userRef);

        // Clean up signaling data
        const offersRef = ref(getDb(), `voiceChat/${this.roomId}/offers/${this.odedUserId}`);
        await remove(offersRef);
        const answersRef = ref(getDb(), `voiceChat/${this.roomId}/answers/${this.odedUserId}`);
        await remove(answersRef);
        const candidatesRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.odedUserId}`);
        await remove(candidatesRef);
    }

    // Toggle mute
    toggleMute(): boolean {
        if (this.localStream) {
            this.isMuted = !this.isMuted;
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });
        }
        return this.isMuted;
    }

    // Get mute status
    getMuteStatus(): boolean {
        return this.isMuted;
    }

    // Create peer connection for a user
    private createPeerConnection(remoteUserId: string): RTCPeerConnection {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });
        }

        // Handle incoming tracks
        pc.ontrack = (event) => {
            if (event.streams[0]) {
                this.callbacks.onRemoteStream(remoteUserId, event.streams[0]);
            }
        };

        // Handle ICE candidates
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                const candidateRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${remoteUserId}/${this.odedUserId}`);
                await push(candidateRef, event.candidate.toJSON());
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.handleUserDisconnected(remoteUserId);
            }
        };

        this.peerConnections.set(remoteUserId, pc);
        return pc;
    }

    // Listen for new users joining
    private listenForUsers(): void {
        const usersRef = ref(getDb(), `voiceChat/${this.roomId}/users`);

        onChildAdded(usersRef, async (snapshot) => {
            const userData = snapshot.val();
            const remoteUserId = userData.odedUserId;

            if (remoteUserId !== this.odedUserId && !this.peerConnections.has(remoteUserId)) {
                // Create offer for new user
                await this.createOffer(remoteUserId);
            }
        });

        onChildRemoved(usersRef, (snapshot) => {
            const userData = snapshot.val();
            this.handleUserDisconnected(userData.odedUserId);
        });
    }

    // Create and send offer
    private async createOffer(remoteUserId: string): Promise<void> {
        const pc = this.createPeerConnection(remoteUserId);

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const offerRef = ref(getDb(), `voiceChat/${this.roomId}/offers/${remoteUserId}/${this.odedUserId}`);
            await set(offerRef, {
                odedUserId: this.odedUserId,
                offer: offer.sdp,
                type: offer.type,
            });
        } catch (error) {
            this.callbacks.onError(error as Error);
        }
    }

    // Listen for offers
    private listenForOffers(): void {
        const offersRef = ref(getDb(), `voiceChat/${this.roomId}/offers/${this.odedUserId}`);

        onChildAdded(offersRef, async (snapshot) => {
            const data = snapshot.val();
            const remoteUserId = data.odedUserId;

            if (!this.peerConnections.has(remoteUserId)) {
                const pc = this.createPeerConnection(remoteUserId);

                try {
                    await pc.setRemoteDescription(new RTCSessionDescription({
                        type: data.type,
                        sdp: data.offer,
                    }));

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    const answerRef = ref(getDb(), `voiceChat/${this.roomId}/answers/${remoteUserId}/${this.odedUserId}`);
                    await set(answerRef, {
                        odedUserId: this.odedUserId,
                        answer: answer.sdp,
                        type: answer.type,
                    });
                } catch (error) {
                    this.callbacks.onError(error as Error);
                }
            }
        });
    }

    // Listen for answers
    private listenForAnswers(): void {
        const answersRef = ref(getDb(), `voiceChat/${this.roomId}/answers/${this.odedUserId}`);

        onChildAdded(answersRef, async (snapshot) => {
            const data = snapshot.val();
            const remoteUserId = data.odedUserId;
            const pc = this.peerConnections.get(remoteUserId);

            if (pc && pc.signalingState !== 'stable') {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription({
                        type: data.type,
                        sdp: data.answer,
                    }));
                } catch (error) {
                    this.callbacks.onError(error as Error);
                }
            }
        });
    }

    // Listen for ICE candidates
    private listenForIceCandidates(): void {
        const candidatesRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.odedUserId}`);

        onChildAdded(candidatesRef, (senderSnapshot) => {
            const senderId = senderSnapshot.key;
            if (senderId) {
                const senderCandidatesRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.odedUserId}/${senderId}`);

                onChildAdded(senderCandidatesRef, async (candidateSnapshot) => {
                    const candidateData = candidateSnapshot.val();
                    const pc = this.peerConnections.get(senderId);

                    if (pc && candidateData) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
                        } catch (error) {
                            // Ignore ICE candidate errors (they're common and usually not critical)
                        }
                    }
                });
            }
        });
    }

    // Handle user disconnected
    private handleUserDisconnected(odedUserId: string): void {
        const pc = this.peerConnections.get(odedUserId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(odedUserId);
            this.callbacks.onUserLeft(odedUserId);
        }
    }
}

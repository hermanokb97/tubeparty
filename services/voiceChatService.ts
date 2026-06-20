import {
    getDatabase,
    ref,
    set,
    push,
    remove,
    onChildAdded,
    onChildRemoved,
    onDisconnect,
    Database,
} from 'firebase/database';
import { ensureFirebaseReady, getFirebaseDatabase } from './firebaseService';

let database: Database | null = null;
const getDb = (): Database => {
    if (!database) {
        try {
            database = getFirebaseDatabase();
        } catch {
            database = getDatabase();
        }
    }
    return database;
};

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:openrelay.metered.ca:80' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
    iceCandidatePoolSize: 10,
};

interface VoiceChatCallbacks {
    onRemoteStream: (userId: string, stream: MediaStream) => void;
    onUserLeft: (userId: string) => void;
    onError: (error: Error) => void;
    onConnectionStateChange?: (userId: string, state: string) => void;
    onStatusChange?: (status: string) => void;
}

type ListenerCleanup = () => void;

const getSignalingUserId = (data: any): string | undefined => data?.userId || data?.odedUserId;

export class VoiceChatService {
    private roomId: string;
    private userId: string;
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private pendingCandidates: Map<string, RTCIceCandidate[]> = new Map();
    private callbacks: VoiceChatCallbacks;
    private isMuted = false;
    private isJoined = false;
    private isLeaving = false;
    private listenerCleanups: ListenerCleanup[] = [];

    constructor(roomId: string, userId: string, callbacks: VoiceChatCallbacks) {
        this.roomId = roomId;
        this.userId = userId;
        this.callbacks = callbacks;
    }

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
            console.error('[VoiceChat] Failed to get user media:', error);
            throw new Error('Failed to access microphone');
        }
    }

    async join(): Promise<void> {
        if (this.isJoined) return;

        this.callbacks.onStatusChange?.('Connecting microphone...');

        if (!this.localStream) {
            await this.initialize();
        }

        await ensureFirebaseReady();
        this.callbacks.onStatusChange?.('Connecting voice server...');

        await this.cleanupOwnSignalingData();

        const userRef = ref(getDb(), `voiceChat/${this.roomId}/users/${this.userId}`);
        await set(userRef, {
            userId: this.userId,
            joinedAt: Date.now(),
        });
        await onDisconnect(userRef).remove();

        this.listenForUsers();
        this.listenForOffers();
        this.listenForAnswers();
        this.listenForIceCandidates();

        this.isJoined = true;
        this.callbacks.onStatusChange?.('Connected - waiting for others');
    }

    async leave(): Promise<void> {
        if (this.isLeaving) return;
        this.isLeaving = true;

        this.listenerCleanups.forEach(cleanup => cleanup());
        this.listenerCleanups = [];

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.pendingCandidates.clear();

        try {
            await ensureFirebaseReady();
            await this.cleanupOwnSignalingData();
            await remove(ref(getDb(), `voiceChat/${this.roomId}/users/${this.userId}`));
        } catch (error) {
            console.error('[VoiceChat] Error cleaning up:', error);
        } finally {
            this.isJoined = false;
            this.isLeaving = false;
        }
    }

    toggleMute(): boolean {
        if (this.localStream) {
            this.isMuted = !this.isMuted;
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });
        }
        return this.isMuted;
    }

    getMuteStatus(): boolean {
        return this.isMuted;
    }

    private async cleanupOwnSignalingData(): Promise<void> {
        await Promise.all([
            remove(ref(getDb(), `voiceChat/${this.roomId}/offers/${this.userId}`)),
            remove(ref(getDb(), `voiceChat/${this.roomId}/answers/${this.userId}`)),
            remove(ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.userId}`)),
        ]);
    }

    private addListenerCleanup(cleanup: ListenerCleanup): void {
        this.listenerCleanups.push(cleanup);
    }

    private createPeerConnection(remoteUserId: string): RTCPeerConnection {
        const existing = this.peerConnections.get(remoteUserId);
        if (existing) return existing;

        const pc = new RTCPeerConnection(ICE_SERVERS);

        this.localStream?.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream!);
        });

        pc.ontrack = (event) => {
            if (event.streams[0]) {
                this.callbacks.onRemoteStream(remoteUserId, event.streams[0]);
            }
        };

        pc.onicecandidate = async (event) => {
            if (!event.candidate) return;

            try {
                const candidateRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${remoteUserId}/${this.userId}`);
                await push(candidateRef, event.candidate.toJSON());
            } catch (error) {
                console.error('[VoiceChat] Failed to send ICE candidate:', error);
            }
        };

        pc.oniceconnectionstatechange = () => {
            this.callbacks.onConnectionStateChange?.(remoteUserId, `ICE: ${pc.iceConnectionState}`);

            if (pc.iceConnectionState === 'checking') {
                this.callbacks.onStatusChange?.('Checking voice connection...');
            } else if (pc.iceConnectionState === 'connected') {
                this.callbacks.onStatusChange?.('Voice connected');
            } else if (pc.iceConnectionState === 'failed') {
                this.callbacks.onStatusChange?.('Retrying voice connection...');
                pc.restartIce();
            } else if (pc.iceConnectionState === 'disconnected') {
                this.callbacks.onStatusChange?.('Voice disconnected, reconnecting...');
            }
        };

        pc.onconnectionstatechange = () => {
            this.callbacks.onConnectionStateChange?.(remoteUserId, `Connection: ${pc.connectionState}`);

            if (pc.connectionState === 'connecting') {
                this.callbacks.onStatusChange?.('Connecting peer...');
            } else if (pc.connectionState === 'connected') {
                this.callbacks.onStatusChange?.('Voice connected');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.handleUserDisconnected(remoteUserId);
            }
        };

        this.peerConnections.set(remoteUserId, pc);
        return pc;
    }

    private async applyPendingCandidates(remoteUserId: string): Promise<void> {
        const pending = this.pendingCandidates.get(remoteUserId) || [];
        const pc = this.peerConnections.get(remoteUserId);

        if (!pc || pending.length === 0) return;

        for (const candidate of pending) {
            try {
                await pc.addIceCandidate(candidate);
            } catch (error) {
                console.warn('[VoiceChat] Failed to add pending candidate:', error);
            }
        }
        this.pendingCandidates.delete(remoteUserId);
    }

    private listenForUsers(): void {
        const usersRef = ref(getDb(), `voiceChat/${this.roomId}/users`);

        this.addListenerCleanup(onChildAdded(usersRef, async (snapshot) => {
            const remoteUserId = getSignalingUserId(snapshot.val());
            if (!remoteUserId || remoteUserId === this.userId || this.peerConnections.has(remoteUserId)) return;

            if (this.userId > remoteUserId) {
                await this.createOffer(remoteUserId);
            }
        }));

        this.addListenerCleanup(onChildRemoved(usersRef, (snapshot) => {
            const remoteUserId = getSignalingUserId(snapshot.val());
            if (remoteUserId) {
                this.handleUserDisconnected(remoteUserId);
            }
        }));
    }

    private async createOffer(remoteUserId: string): Promise<void> {
        const pc = this.createPeerConnection(remoteUserId);

        try {
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
            });
            await pc.setLocalDescription(offer);

            const offerRef = ref(getDb(), `voiceChat/${this.roomId}/offers/${remoteUserId}/${this.userId}`);
            await set(offerRef, {
                userId: this.userId,
                offer: offer.sdp,
                type: offer.type,
            });
        } catch (error) {
            console.error('[VoiceChat] Failed to create offer:', error);
            this.callbacks.onError(error as Error);
        }
    }

    private listenForOffers(): void {
        const offersRef = ref(getDb(), `voiceChat/${this.roomId}/offers/${this.userId}`);

        this.addListenerCleanup(onChildAdded(offersRef, async (snapshot) => {
            const data = snapshot.val();
            const remoteUserId = getSignalingUserId(data);
            if (!remoteUserId || this.peerConnections.has(remoteUserId)) return;

            const pc = this.createPeerConnection(remoteUserId);

            try {
                await pc.setRemoteDescription(new RTCSessionDescription({
                    type: data.type,
                    sdp: data.offer,
                }));

                await this.applyPendingCandidates(remoteUserId);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                const answerRef = ref(getDb(), `voiceChat/${this.roomId}/answers/${remoteUserId}/${this.userId}`);
                await set(answerRef, {
                    userId: this.userId,
                    answer: answer.sdp,
                    type: answer.type,
                });
            } catch (error) {
                console.error('[VoiceChat] Failed to handle offer:', error);
                this.callbacks.onError(error as Error);
            }
        }));
    }

    private listenForAnswers(): void {
        const answersRef = ref(getDb(), `voiceChat/${this.roomId}/answers/${this.userId}`);

        this.addListenerCleanup(onChildAdded(answersRef, async (snapshot) => {
            const data = snapshot.val();
            const remoteUserId = getSignalingUserId(data);
            if (!remoteUserId) return;

            const pc = this.peerConnections.get(remoteUserId);
            if (!pc || (pc.signalingState !== 'have-local-offer' && pc.signalingState !== 'stable')) return;

            try {
                await pc.setRemoteDescription(new RTCSessionDescription({
                    type: data.type as RTCSdpType,
                    sdp: data.answer,
                }));
                await this.applyPendingCandidates(remoteUserId);
            } catch (error) {
                console.error('[VoiceChat] Failed to set remote description:', error);
                this.callbacks.onError(error as Error);
            }
        }));
    }

    private listenForIceCandidates(): void {
        const candidatesRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.userId}`);

        this.addListenerCleanup(onChildAdded(candidatesRef, (senderSnapshot) => {
            const senderId = senderSnapshot.key;
            if (!senderId) return;

            const senderCandidatesRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.userId}/${senderId}`);
            const cleanup = onChildAdded(senderCandidatesRef, async (candidateSnapshot) => {
                const candidateData = candidateSnapshot.val();
                if (!candidateData) return;

                const pc = this.peerConnections.get(senderId);
                const candidate = new RTCIceCandidate(candidateData);

                if (pc?.remoteDescription) {
                    try {
                        await pc.addIceCandidate(candidate);
                    } catch (error) {
                        console.warn('[VoiceChat] Failed to add ICE candidate:', error);
                    }
                } else {
                    const pending = this.pendingCandidates.get(senderId) || [];
                    pending.push(candidate);
                    this.pendingCandidates.set(senderId, pending);
                }
            });

            this.addListenerCleanup(cleanup);
        }));
    }

    private handleUserDisconnected(userId: string): void {
        const pc = this.peerConnections.get(userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(userId);
            this.pendingCandidates.delete(userId);
            this.callbacks.onUserLeft(userId);
        }
    }
}

// WebRTC Voice Chat Service
// Uses Firebase Realtime Database for signaling

import { getDatabase, ref, set, push, remove, onChildAdded, onChildRemoved, Database } from 'firebase/database';

// Lazy initialization of database
let database: Database | null = null;
const getDb = (): Database => {
    if (!database) {
        database = getDatabase();
    }
    return database;
};

// STUN/TURN servers for NAT traversal
// 무료 공개 TURN 서버 포함 (OpenRelay 프로젝트)
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // OpenRelay TURN servers (무료, https://www.metered.ca/tools/openrelay/)
        {
            urls: 'stun:openrelay.metered.ca:80',
        },
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
    onStatusChange?: (status: string) => void; // 전체 상태 변경
}

export class VoiceChatService {
    private roomId: string;
    private odedUserId: string;
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private pendingCandidates: Map<string, RTCIceCandidate[]> = new Map();
    private callbacks: VoiceChatCallbacks;
    private isMuted: boolean = false;

    constructor(roomId: string, odedUserId: string, callbacks: VoiceChatCallbacks) {
        this.roomId = roomId;
        this.odedUserId = odedUserId;
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
            console.log('[VoiceChat] Local stream initialized');
            return this.localStream;
        } catch (error) {
            console.error('[VoiceChat] Failed to get user media:', error);
            throw new Error('Failed to access microphone');
        }
    }

    async join(): Promise<void> {
        this.callbacks.onStatusChange?.('🎤 마이크 연결 중...');
        
        if (!this.localStream) {
            await this.initialize();
        }

        this.callbacks.onStatusChange?.('🔗 서버 연결 중...');
        console.log('[VoiceChat] Joining room:', this.roomId);

        // Clean up any stale signaling data from previous sessions
        try {
            console.log('[VoiceChat] Cleaning up stale signaling data...');
            await remove(ref(getDb(), `voiceChat/${this.roomId}/offers/${this.odedUserId}`));
            await remove(ref(getDb(), `voiceChat/${this.roomId}/answers/${this.odedUserId}`));
            await remove(ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.odedUserId}`));
        } catch (error) {
            console.warn('[VoiceChat] Error cleaning up stale data:', error);
        }

        // Register user in voice chat room
        const userRef = ref(getDb(), `voiceChat/${this.roomId}/users/${this.odedUserId}`);
        await set(userRef, {
            odedUserId: this.odedUserId,
            joinedAt: Date.now(),
        });

        this.listenForUsers();
        this.listenForOffers();
        this.listenForAnswers();
        this.listenForIceCandidates();
        
        // 참가 완료 알림
        this.callbacks.onStatusChange?.('✅ 연결됨 - 다른 참가자 대기 중');
    }

    async leave(): Promise<void> {
        console.log('[VoiceChat] Leaving room');

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.peerConnections.forEach((pc) => pc.close());
        this.peerConnections.clear();
        this.pendingCandidates.clear();

        try {
            await remove(ref(getDb(), `voiceChat/${this.roomId}/users/${this.odedUserId}`));
            await remove(ref(getDb(), `voiceChat/${this.roomId}/offers/${this.odedUserId}`));
            await remove(ref(getDb(), `voiceChat/${this.roomId}/answers/${this.odedUserId}`));
            await remove(ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.odedUserId}`));
        } catch (error) {
            console.error('[VoiceChat] Error cleaning up:', error);
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

    private createPeerConnection(remoteUserId: string): RTCPeerConnection {
        console.log('[VoiceChat] Creating peer connection for:', remoteUserId);

        const pc = new RTCPeerConnection(ICE_SERVERS);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });
        }

        pc.ontrack = (event) => {
            console.log('[VoiceChat] Received remote track from:', remoteUserId);
            if (event.streams[0]) {
                this.callbacks.onRemoteStream(remoteUserId, event.streams[0]);
            }
        };

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                console.log('[VoiceChat] Sending ICE candidate to:', remoteUserId);
                try {
                    const candidateRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${remoteUserId}/${this.odedUserId}`);
                    await push(candidateRef, event.candidate.toJSON());
                } catch (error) {
                    console.error('[VoiceChat] Failed to send ICE candidate:', error);
                }
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[VoiceChat] ICE state:', pc.iceConnectionState);
            this.callbacks.onConnectionStateChange?.(remoteUserId, `ICE: ${pc.iceConnectionState}`);
            
            if (pc.iceConnectionState === 'checking') {
                this.callbacks.onStatusChange?.('🔄 연결 확인 중...');
            } else if (pc.iceConnectionState === 'connected') {
                console.log('[VoiceChat] ICE connected successfully!');
                this.callbacks.onStatusChange?.('🔊 음성 연결됨');
            } else if (pc.iceConnectionState === 'failed') {
                console.log('[VoiceChat] ICE failed, restarting...');
                this.callbacks.onStatusChange?.('⚠️ 연결 재시도 중...');
                pc.restartIce();
            } else if (pc.iceConnectionState === 'disconnected') {
                this.callbacks.onStatusChange?.('⏳ 연결 끊김, 재연결 중...');
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('[VoiceChat] Connection state:', pc.connectionState);
            this.callbacks.onConnectionStateChange?.(remoteUserId, `연결: ${pc.connectionState}`);
            
            if (pc.connectionState === 'connecting') {
                this.callbacks.onStatusChange?.('🔄 피어 연결 중...');
            } else if (pc.connectionState === 'connected') {
                console.log('[VoiceChat] Peer connected successfully!');
                this.callbacks.onStatusChange?.('🔊 음성 연결됨');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.handleUserDisconnected(remoteUserId);
            }
        };
        
        // ICE gathering 상태 모니터링
        pc.onicegatheringstatechange = () => {
            console.log('[VoiceChat] ICE gathering state:', pc.iceGatheringState);
        };

        this.peerConnections.set(remoteUserId, pc);
        return pc;
    }

    private async applyPendingCandidates(remoteUserId: string): Promise<void> {
        const pending = this.pendingCandidates.get(remoteUserId) || [];
        const pc = this.peerConnections.get(remoteUserId);

        if (pc && pending.length > 0) {
            console.log('[VoiceChat] Applying', pending.length, 'pending candidates');
            for (const candidate of pending) {
                try {
                    await pc.addIceCandidate(candidate);
                } catch (error) {
                    console.warn('[VoiceChat] Failed to add pending candidate');
                }
            }
            this.pendingCandidates.delete(remoteUserId);
        }
    }

    private listenForUsers(): void {
        const usersRef = ref(getDb(), `voiceChat/${this.roomId}/users`);

        onChildAdded(usersRef, async (snapshot) => {
            const userData = snapshot.val();
            const remoteUserId = userData.odedUserId;

            if (remoteUserId !== this.odedUserId && !this.peerConnections.has(remoteUserId)) {
                if (this.odedUserId > remoteUserId) {
                    console.log('[VoiceChat] Creating offer for:', remoteUserId);
                    await this.createOffer(remoteUserId);
                }
            }
        });

        onChildRemoved(usersRef, (snapshot) => {
            const userData = snapshot.val();
            this.handleUserDisconnected(userData.odedUserId);
        });
    }

    private async createOffer(remoteUserId: string): Promise<void> {
        const pc = this.createPeerConnection(remoteUserId);

        try {
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
            });
            await pc.setLocalDescription(offer);

            const offerRef = ref(getDb(), `voiceChat/${this.roomId}/offers/${remoteUserId}/${this.odedUserId}`);
            await set(offerRef, {
                odedUserId: this.odedUserId,
                offer: offer.sdp,
                type: offer.type,
            });
            console.log('[VoiceChat] Offer sent to:', remoteUserId);
        } catch (error) {
            console.error('[VoiceChat] Failed to create offer:', error);
            this.callbacks.onError(error as Error);
        }
    }

    private listenForOffers(): void {
        const offersRef = ref(getDb(), `voiceChat/${this.roomId}/offers/${this.odedUserId}`);

        onChildAdded(offersRef, async (snapshot) => {
            const data = snapshot.val();
            const remoteUserId = data.odedUserId;

            console.log('[VoiceChat] Received offer from:', remoteUserId);

            if (!this.peerConnections.has(remoteUserId)) {
                const pc = this.createPeerConnection(remoteUserId);

                try {
                    await pc.setRemoteDescription(new RTCSessionDescription({
                        type: data.type,
                        sdp: data.offer,
                    }));

                    await this.applyPendingCandidates(remoteUserId);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    const answerRef = ref(getDb(), `voiceChat/${this.roomId}/answers/${remoteUserId}/${this.odedUserId}`);
                    await set(answerRef, {
                        odedUserId: this.odedUserId,
                        answer: answer.sdp,
                        type: answer.type,
                    });
                    console.log('[VoiceChat] Answer sent to:', remoteUserId);
                } catch (error) {
                    console.error('[VoiceChat] Failed to handle offer:', error);
                    this.callbacks.onError(error as Error);
                }
            }
        });
    }

    private listenForAnswers(): void {
        const answersRef = ref(getDb(), `voiceChat/${this.roomId}/answers/${this.odedUserId}`);

        onChildAdded(answersRef, async (snapshot) => {
            const data = snapshot.val();
            const remoteUserId = data.odedUserId;
            const pc = this.peerConnections.get(remoteUserId);

            console.log('[VoiceChat] Received answer from:', remoteUserId);
            console.log('[VoiceChat] PC exists:', !!pc);
            if (pc) {
                console.log('[VoiceChat] Current signalingState:', pc.signalingState);
            }

            if (pc) {
                // Accept answer if we're waiting for one (have-local-offer) or if state is stable but we haven't received remote track yet
                if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'stable') {
                    try {
                        console.log('[VoiceChat] Setting remote description (answer)...');
                        await pc.setRemoteDescription(new RTCSessionDescription({
                            type: data.type as RTCSdpType,
                            sdp: data.answer,
                        }));
                        console.log('[VoiceChat] Remote description set successfully');
                        console.log('[VoiceChat] New signalingState:', pc.signalingState);
                        await this.applyPendingCandidates(remoteUserId);
                    } catch (error) {
                        console.error('[VoiceChat] Failed to set remote description:', error);
                        this.callbacks.onError(error as Error);
                    }
                } else {
                    console.log('[VoiceChat] Skipping answer - signalingState is:', pc.signalingState);
                }
            } else {
                console.log('[VoiceChat] No peer connection found for:', remoteUserId);
            }
        });
    }

    private listenForIceCandidates(): void {
        const candidatesRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.odedUserId}`);

        onChildAdded(candidatesRef, (senderSnapshot) => {
            const senderId = senderSnapshot.key;
            if (!senderId) return;

            const senderCandidatesRef = ref(getDb(), `voiceChat/${this.roomId}/candidates/${this.odedUserId}/${senderId}`);

            onChildAdded(senderCandidatesRef, async (candidateSnapshot) => {
                const candidateData = candidateSnapshot.val();
                if (!candidateData) return;

                const pc = this.peerConnections.get(senderId);
                const candidate = new RTCIceCandidate(candidateData);

                if (pc && pc.remoteDescription) {
                    try {
                        await pc.addIceCandidate(candidate);
                    } catch (error) {
                        console.warn('[VoiceChat] Failed to add ICE candidate');
                    }
                } else {
                    const pending = this.pendingCandidates.get(senderId) || [];
                    pending.push(candidate);
                    this.pendingCandidates.set(senderId, pending);
                }
            });
        });
    }

    private handleUserDisconnected(odedUserId: string): void {
        const pc = this.peerConnections.get(odedUserId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(odedUserId);
            this.pendingCandidates.delete(odedUserId);
            this.callbacks.onUserLeft(odedUserId);
        }
    }
}

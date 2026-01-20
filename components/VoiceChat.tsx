import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Volume2, VolumeX, Users } from 'lucide-react';
import { VoiceChatService } from '../services/voiceChatService';

interface VoiceChatProps {
    roomId: string;
    userId: string;
    userName: string;
    onError?: (error: string) => void;
}

interface RemoteUser {
    odedUserId: string;
    stream: MediaStream;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({
    roomId,
    userId,
    userName,
    onError,
}) => {
    const [isJoined, setIsJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
    const [audioStatus, setAudioStatus] = useState<string>('');

    const voiceChatRef = useRef<VoiceChatService | null>(null);
    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

    // Handle remote stream
    const handleRemoteStream = useCallback((remoteodedUserId: string, stream: MediaStream) => {
        console.log('[VoiceChat UI] Received remote stream:', remoteodedUserId);
        console.log('[VoiceChat UI] Stream tracks:', stream.getTracks().map(t => ({
            kind: t.kind,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
        })));

        setRemoteUsers(prev => {
            if (prev.some(u => u.odedUserId === remoteodedUserId)) {
                return prev.map(u =>
                    u.odedUserId === remoteodedUserId ? { ...u, stream } : u
                );
            }
            return [...prev, { odedUserId: remoteodedUserId, stream }];
        });

        setAudioStatus(`Stream received from ${remoteodedUserId.slice(-6)}`);
    }, []);

    // Handle user left
    const handleUserLeft = useCallback((remoteodedUserId: string) => {
        console.log('[VoiceChat UI] User left:', remoteodedUserId);
        setRemoteUsers(prev => prev.filter(u => u.odedUserId !== remoteodedUserId));

        const audio = audioRefs.current.get(remoteodedUserId);
        if (audio) {
            audio.pause();
            audio.srcObject = null;
            if (audio.parentNode) {
                audio.parentNode.removeChild(audio);
            }
            audioRefs.current.delete(remoteodedUserId);
        }
    }, []);

    // Handle error
    const handleError = useCallback((error: Error) => {
        console.error('[VoiceChat UI] Error:', error);
        setAudioStatus(`Error: ${error.message}`);
        onError?.(error.message);
    }, [onError]);

    // Join voice chat
    const handleJoin = async () => {
        setIsConnecting(true);
        setAudioStatus('Connecting...');
        try {
            voiceChatRef.current = new VoiceChatService(roomId, userId, {
                onRemoteStream: handleRemoteStream,
                onUserLeft: handleUserLeft,
                onError: handleError,
            });

            await voiceChatRef.current.join();
            setIsJoined(true);
            setAudioStatus('Connected - waiting for others');
        } catch (error) {
            handleError(error as Error);
        } finally {
            setIsConnecting(false);
        }
    };

    // Leave voice chat
    const handleLeave = async () => {
        if (voiceChatRef.current) {
            await voiceChatRef.current.leave();
            voiceChatRef.current = null;
        }
        setIsJoined(false);
        setRemoteUsers([]);
        setAudioStatus('');

        // Clean up all audio elements
        audioRefs.current.forEach((audio, key) => {
            audio.pause();
            audio.srcObject = null;
            if (audio.parentNode) {
                audio.parentNode.removeChild(audio);
            }
        });
        audioRefs.current.clear();
    };

    // Toggle mute
    const handleToggleMute = () => {
        if (voiceChatRef.current) {
            const muted = voiceChatRef.current.toggleMute();
            setIsMuted(muted);
            setAudioStatus(muted ? 'Mic muted' : 'Mic unmuted');
        }
    };

    // Toggle deafen
    const handleToggleDeafen = () => {
        const newDeafened = !isDeafened;
        setIsDeafened(newDeafened);
        audioRefs.current.forEach(audio => {
            audio.muted = newDeafened;
        });
        setAudioStatus(newDeafened ? 'Speaker muted' : 'Speaker unmuted');
    };

    // Play remote audio streams
    useEffect(() => {
        remoteUsers.forEach(user => {
            let audio = audioRefs.current.get(user.odedUserId);

            if (!audio) {
                console.log('[VoiceChat UI] Creating audio element for:', user.odedUserId);
                audio = document.createElement('audio');
                audio.id = `voice-audio-${user.odedUserId}`;
                audio.autoplay = true;
                audio.playsInline = true;
                audio.volume = 1.0;
                audio.style.display = 'none';
                document.body.appendChild(audio);
                audioRefs.current.set(user.odedUserId, audio);

                // Debug events
                audio.onplay = () => {
                    console.log('[VoiceChat UI] Audio playing for:', user.odedUserId);
                    setAudioStatus(`Playing audio from ${user.odedUserId.slice(-6)}`);
                };
                audio.onerror = (e) => {
                    console.error('[VoiceChat UI] Audio error:', e);
                    setAudioStatus('Audio error');
                };
                audio.onloadedmetadata = () => {
                    console.log('[VoiceChat UI] Audio metadata loaded');
                };
            }

            if (audio.srcObject !== user.stream) {
                console.log('[VoiceChat UI] Setting stream to audio element');
                audio.srcObject = user.stream;
                audio.muted = isDeafened;

                // Force play
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('[VoiceChat UI] Audio playback started successfully');
                            setAudioStatus('Audio playing');
                        })
                        .catch(err => {
                            console.error('[VoiceChat UI] Audio play failed:', err);
                            setAudioStatus(`Play failed: ${err.name}`);
                        });
                }
            }
        });
    }, [remoteUsers, isDeafened]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (voiceChatRef.current) {
                voiceChatRef.current.leave();
            }
            audioRefs.current.forEach((audio) => {
                audio.pause();
                audio.srcObject = null;
                if (audio.parentNode) {
                    audio.parentNode.removeChild(audio);
                }
            });
            audioRefs.current.clear();
        };
    }, []);

    if (!isJoined) {
        return (
            <button
                onClick={handleJoin}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded-full text-sm font-medium transition-all shadow-lg"
            >
                {isConnecting ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        연결 중...
                    </>
                ) : (
                    <>
                        <PhoneCall size={16} />
                        음성 참가
                    </>
                )}
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2 bg-gray-800/80 rounded-full px-3 py-1.5 border border-gray-700">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">
                    {remoteUsers.length > 0 ? (
                        <span className="flex items-center gap-1">
                            <Users size={12} />
                            {remoteUsers.length + 1}명
                        </span>
                    ) : (
                        '음성 연결됨'
                    )}
                </span>
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-600" />

            {/* Mute button */}
            <button
                onClick={handleToggleMute}
                className={`p-1.5 rounded-full transition-colors ${isMuted
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'hover:bg-gray-700 text-gray-300'
                    }`}
                title={isMuted ? '마이크 켜기' : '마이크 끄기'}
            >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            {/* Deafen button */}
            <button
                onClick={handleToggleDeafen}
                className={`p-1.5 rounded-full transition-colors ${isDeafened
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'hover:bg-gray-700 text-gray-300'
                    }`}
                title={isDeafened ? '스피커 켜기' : '스피커 끄기'}
            >
                {isDeafened ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-600" />

            {/* Leave button */}
            <button
                onClick={handleLeave}
                className="p-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="음성 나가기"
            >
                <PhoneOff size={16} />
            </button>
        </div>
    );
};

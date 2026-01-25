import React, { useEffect, useRef, useCallback, useState } from 'react';
import { SkipForward, Users, Radio, Volume2, VolumeX, Music } from 'lucide-react';

export interface PlaybackSyncState {
  currentTime: number;
  isPlaying: boolean;
  videoId: string;
  syncedBy: string;
  syncedAt: number;
}

interface VideoPlayerProps {
  videoId: string;
  onVideoEnd?: () => void;
  onVideoError?: () => void;
  // 동기화 관련 props
  currentUserId?: string;
  syncState?: PlaybackSyncState | null;
  onPlaybackSync?: (state: Omit<PlaybackSyncState, 'syncedAt'>) => void;
  syncEnabled?: boolean;
}

// Extend Window interface to include YouTube API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let apiLoaded = false;
let apiLoadingPromise: Promise<void> | null = null;

const loadYouTubeAPI = (): Promise<void> => {
  if (apiLoaded && window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (apiLoadingPromise) {
    return apiLoadingPromise;
  }

  apiLoadingPromise = new Promise((resolve) => {
    // Check if already loaded
    if (window.YT && window.YT.Player) {
      apiLoaded = true;
      resolve();
      return;
    }

    // Set callback before loading script
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      if (existingCallback) existingCallback();
      resolve();
    };

    // Check if script already exists
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  });

  return apiLoadingPromise;
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  onVideoEnd,
  onVideoError,
  currentUserId,
  syncState,
  onPlaybackSync,
  syncEnabled = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onVideoEndRef = useRef(onVideoEnd);
  const onVideoErrorRef = useRef(onVideoError);
  const onPlaybackSyncRef = useRef(onPlaybackSync);
  
  // 동기화 관련 refs
  const lastSyncTimeRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const lastAppliedSyncRef = useRef<number>(0);
  
  // 에러 재시도 관련 refs
  const errorRetryCountRef = useRef<number>(0);
  const playerReadyRef = useRef<boolean>(false);
  const videoStartedRef = useRef<boolean>(false);

  // Keep refs updated
  useEffect(() => {
    onVideoEndRef.current = onVideoEnd;
    onVideoErrorRef.current = onVideoError;
    onPlaybackSyncRef.current = onPlaybackSync;
  }, [onVideoEnd, onVideoError, onPlaybackSync]);

  // 동기화 상태 적용 (다른 사용자가 변경한 경우)
  useEffect(() => {
    if (!syncState || !playerRef.current || !syncEnabled) return;
    if (!currentUserId) return;
    
    // 내가 트리거한 동기화면 무시
    if (syncState.syncedBy === currentUserId) return;
    
    // 이미 적용한 동기화면 무시
    if (syncState.syncedAt <= lastAppliedSyncRef.current) return;
    
    // 비디오 ID가 다르면 무시 (비디오 변경은 다른 로직에서 처리)
    if (syncState.videoId !== videoId) return;
    
    const player = playerRef.current;
    
    try {
      // 네트워크 지연 보정: syncedAt 이후 경과 시간을 더해줌
      const elapsed = (Date.now() - syncState.syncedAt) / 1000;
      const targetTime = syncState.currentTime + (syncState.isPlaying ? elapsed : 0);
      
      console.log(`[Sync] Applying sync from ${syncState.syncedBy}: ${targetTime.toFixed(1)}s, playing: ${syncState.isPlaying}`);
      
      isSyncingRef.current = true;
      
      // 시간 이동
      if (typeof player.seekTo === 'function') {
        player.seekTo(targetTime, true);
      }
      
      // 재생/일시정지 상태 적용
      if (syncState.isPlaying) {
        if (typeof player.playVideo === 'function') {
          player.playVideo();
        }
      } else {
        if (typeof player.pauseVideo === 'function') {
          player.pauseVideo();
        }
      }
      
      lastAppliedSyncRef.current = syncState.syncedAt;
      
      // 잠시 후 동기화 플래그 해제
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 1000);
      
    } catch (e) {
      console.error('Error applying sync state:', e);
      isSyncingRef.current = false;
    }
  }, [syncState, videoId, currentUserId, syncEnabled]);

  // 동기화 브로드캐스트 함수
  const broadcastSync = useCallback((isPlaying: boolean) => {
    if (!onPlaybackSyncRef.current || !playerRef.current || !currentUserId || !syncEnabled) return;
    if (isSyncingRef.current) return; // 동기화 적용 중이면 브로드캐스트하지 않음
    
    // 너무 자주 동기화하지 않도록 throttle (1초)
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 1000) return;
    lastSyncTimeRef.current = now;
    
    try {
      const currentTime = playerRef.current.getCurrentTime?.() || 0;
      
      console.log(`[Sync] Broadcasting: ${currentTime.toFixed(1)}s, playing: ${isPlaying}`);
      
      onPlaybackSyncRef.current({
        currentTime,
        isPlaying,
        videoId,
        syncedBy: currentUserId
      });
    } catch (e) {
      console.error('Error broadcasting sync:', e);
    }
  }, [videoId, currentUserId, syncEnabled]);

  const initPlayer = useCallback(async () => {
    await loadYouTubeAPI();

    if (!containerRef.current) return;

    // 새 비디오 로드 시 refs 리셋
    playerReadyRef.current = false;
    videoStartedRef.current = false;
    errorRetryCountRef.current = 0;

    // Destroy existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.error('Error destroying player:', e);
      }
      playerRef.current = null;
    }

    // Create new player
    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin,
      },
      events: {
        onStateChange: (event: any) => {
          console.log('YouTube State Change:', event.data);
          // -1 = unstarted, 0 = ended, 1 = playing, 2 = paused, 3 = buffering, 5 = video cued
          
          // 재생/일시정지 상태 변경시 동기화 브로드캐스트
          if (event.data === 1) { // Playing
            videoStartedRef.current = true; // 비디오가 실제로 재생 시작됨
            errorRetryCountRef.current = 0; // 에러 카운트 리셋
            broadcastSync(true);
          } else if (event.data === 2) { // Paused
            broadcastSync(false);
          }
          
          if (event.data === 0) {
            // 비디오가 실제로 끝났는지 확인 (광고 종료나 버퍼링 문제로 인한 false positive 방지)
            const player = playerRef.current;
            if (player && typeof player.getDuration === 'function' && typeof player.getCurrentTime === 'function') {
              try {
                const duration = player.getDuration();
                const currentTime = player.getCurrentTime();
                console.log(`Video state 0 - Duration: ${duration}s, CurrentTime: ${currentTime}s, videoStarted: ${videoStartedRef.current}`);
                
                // 비디오가 실제로 재생된 적이 있어야 함
                if (!videoStartedRef.current) {
                  console.log('State 0 received but video never started playing, ignoring...');
                  return;
                }
                
                // 비디오 길이가 유효하고, 현재 시간이 총 시간의 85% 이상일 때만 끝난 것으로 처리
                // 최소 10초 이상 재생되었어야 함 (매우 짧은 비디오 제외)
                const minPlayTime = Math.min(10, duration * 0.5);
                if (duration > 0 && currentTime >= minPlayTime && (currentTime / duration >= 0.85)) {
                  console.log('Video actually ended! Calling onVideoEnd...');
                  videoStartedRef.current = false;
                  onVideoEndRef.current?.();
                } else {
                  console.log('State 0 received but video not really ended (possibly ad ended or buffering issue), ignoring...');
                }
              } catch (e) {
                console.error('Error checking video duration:', e);
                // 에러 발생 시에도 onVideoEnd 호출하지 않음
              }
            }
          }
        },
        onError: (event: any) => {
          console.error('YouTube Error:', event.data, 'Retry count:', errorRetryCountRef.current);
          
          // 에러 코드: 2 = 잘못된 요청, 5 = 재생 불가, 100 = 비디오 없음, 101/150 = 임베드 불가
          const fatalErrors = [100, 101, 150]; // 재시도해도 안 되는 에러들
          
          if (fatalErrors.includes(event.data)) {
            // 치명적 에러는 바로 스킵
            console.log('Fatal YouTube error, skipping video');
            onVideoErrorRef.current?.();
            return;
          }
          
          // 최대 2번까지 재시도
          if (errorRetryCountRef.current < 2) {
            errorRetryCountRef.current++;
            console.log(`Retrying video playback (attempt ${errorRetryCountRef.current})...`);
            
            // 잠시 후 재시도
            setTimeout(() => {
              if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
                try {
                  playerRef.current.loadVideoById(videoId);
                } catch (e) {
                  console.error('Retry failed:', e);
                }
              }
            }, 1000);
          } else {
            // 재시도 횟수 초과 시 스킵
            console.log('Max retries exceeded, skipping video');
            errorRetryCountRef.current = 0;
            onVideoErrorRef.current?.();
          }
        },
        onReady: (event: any) => {
          console.log('YouTube Player Ready');
          playerReadyRef.current = true;
          videoStartedRef.current = false; // 새 비디오 로드 시 리셋
          errorRetryCountRef.current = 0;
          
          // 플레이어 준비되면 진행바 클릭(seek) 감지를 위한 폴링 시작
          if (syncEnabled && currentUserId) {
            let lastTime = 0;
            const checkSeek = setInterval(() => {
              if (!playerRef.current) {
                clearInterval(checkSeek);
                return;
              }
              try {
                const currentTime = playerRef.current.getCurrentTime?.() || 0;
                const playerState = playerRef.current.getPlayerState?.();
                
                // 2초 이상 점프했으면 seek으로 간주
                if (Math.abs(currentTime - lastTime) > 2 && playerState === 1) {
                  if (!isSyncingRef.current) {
                    console.log(`[Sync] Seek detected: ${lastTime.toFixed(1)}s -> ${currentTime.toFixed(1)}s`);
                    broadcastSync(true);
                  }
                }
                lastTime = currentTime;
              } catch (e) {
                // ignore
              }
            }, 500);
            
            // cleanup용으로 저장
            (playerRef.current as any).__seekCheckInterval = checkSeek;
          }
        }
      }
    });
  }, [videoId, broadcastSync, syncEnabled, currentUserId]);

  useEffect(() => {
    initPlayer();

    return () => {
      if (playerRef.current) {
        // seek 체크 인터벌 정리
        if ((playerRef.current as any).__seekCheckInterval) {
          clearInterval((playerRef.current as any).__seekCheckInterval);
        }
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        playerRef.current = null;
      }
    };
  }, [videoId, initPlayer]);

  const [syncFeedback, setSyncFeedback] = useState(false);
  const [musicVolume, setMusicVolume] = useState(100);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const handleManualSkip = () => {
    onVideoError?.();
  };

  // 음악 볼륨 조절
  const handleMusicVolumeChange = (newVolume: number) => {
    setMusicVolume(newVolume);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(newVolume);
      if (newVolume > 0 && isMusicMuted) {
        setIsMusicMuted(false);
        playerRef.current.unMute?.();
      }
    }
  };

  // 음악 음소거 토글
  const handleMusicMuteToggle = () => {
    if (playerRef.current) {
      if (isMusicMuted) {
        playerRef.current.unMute?.();
        playerRef.current.setVolume?.(musicVolume);
      } else {
        playerRef.current.mute?.();
      }
      setIsMusicMuted(!isMusicMuted);
    }
  };

  // 수동으로 현재 위치 동기화 (다른 사람들을 내 위치로)
  const handleManualSync = () => {
    if (!onPlaybackSyncRef.current || !playerRef.current || !currentUserId || !syncEnabled) return;
    
    try {
      const currentTime = playerRef.current.getCurrentTime?.() || 0;
      const playerState = playerRef.current.getPlayerState?.();
      const isPlaying = playerState === 1;
      
      console.log(`[Sync] Manual sync triggered: ${currentTime.toFixed(1)}s, playing: ${isPlaying}`);
      
      // 강제로 동기화 (throttle 무시)
      lastSyncTimeRef.current = 0;
      
      onPlaybackSyncRef.current({
        currentTime,
        isPlaying,
        videoId,
        syncedBy: currentUserId
      });
      
      // 피드백 표시
      setSyncFeedback(true);
      setTimeout(() => setSyncFeedback(false), 2000);
      
    } catch (e) {
      console.error('Error manual sync:', e);
    }
  };

  // 10단계 볼륨 프리셋
  const volumePresets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <div className="relative w-full h-0 pb-[56.25%] bg-black rounded-lg overflow-hidden shadow-2xl border border-brand-gray">
      {/* YouTube Player Container - z-index 1 */}
      <div
        ref={containerRef}
        className="absolute top-0 left-0 w-full h-full z-[1]"
      />

      {/* Overlay Container - pointer-events: none로 클릭 통과 */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
        {/* Sync indicator & Manual sync button */}
        {syncEnabled && (
          <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-auto">
            <div className="bg-black/70 text-green-400 px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs">
              <Users size={12} />
              <span>동기화 중</span>
            </div>
            <button
              onClick={handleManualSync}
              className={`px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs transition-all ${
                syncFeedback 
                  ? 'bg-green-500 text-white' 
                  : 'bg-black/70 text-yellow-400 hover:bg-yellow-500 hover:text-black'
              }`}
              title="현재 재생 위치를 다른 사람들에게 공유"
            >
              <Radio size={12} className={syncFeedback ? 'animate-pulse' : ''} />
              <span>{syncFeedback ? '전송됨!' : '지금 위치 공유'}</span>
            </button>
          </div>
        )}

        {/* Bottom controls - 컨테이너는 pointer-events-none, 개별 버튼만 클릭 가능 */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          {/* Music Volume Control */}
          <div className="relative flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-lg flex items-center gap-1.5 transition-colors"
              title="음악 볼륨 조절"
            >
              <Music size={14} className="text-purple-400" />
              {isMusicMuted || musicVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <span className="text-xs ml-1">{isMusicMuted ? 0 : musicVolume}</span>
            </button>
            
            {/* Volume Slider with 10-step buttons */}
            {showVolumeSlider && (
              <div className="absolute bottom-full left-0 mb-2 bg-black/95 rounded-lg p-3 flex flex-col items-center gap-3 shadow-xl border border-gray-700 z-50">
                <span className="text-sm font-medium text-purple-400">🎵 음악 볼륨</span>
                
                {/* Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={isMusicMuted ? 0 : musicVolume}
                  onChange={(e) => handleMusicVolumeChange(Number(e.target.value))}
                  className="w-40 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                
                {/* 10-step preset buttons */}
                <div className="flex flex-wrap gap-1 justify-center max-w-[180px]">
                  {volumePresets.map((vol) => (
                    <button
                      key={vol}
                      onClick={() => handleMusicVolumeChange(vol)}
                      className={`w-8 h-7 text-xs rounded transition-all ${
                        musicVolume === vol && !isMusicMuted
                          ? 'bg-purple-500 text-white font-bold'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {vol}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 w-full">
                  <span className="text-lg font-bold text-white flex-1 text-center">
                    {isMusicMuted ? '🔇 0' : `🔊 ${musicVolume}`}%
                  </span>
                  <button
                    onClick={handleMusicMuteToggle}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      isMusicMuted 
                        ? 'bg-red-500/30 text-red-400 hover:bg-red-500/50' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {isMusicMuted ? '음소거 해제' : '음소거'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Skip button */}
          <button
            onClick={handleManualSkip}
            className="bg-black/70 hover:bg-brand-red text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm pointer-events-auto"
            title="재생 안되면 클릭해서 스킵"
          >
            <SkipForward size={16} />
            스킵
          </button>
        </div>
      </div>
    </div>
  );
};

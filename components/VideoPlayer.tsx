import React, { useEffect, useRef, useCallback, useState } from 'react';
import { SkipForward, Volume2, VolumeX, MapPin, Play } from 'lucide-react';
import { useI18n } from '../services/i18n';

export interface PlaybackSyncState {
  currentTime: number;
  isPlaying: boolean;
  videoId: string;
  syncedBy: string;
  syncedAt: number;
}

export type PlayerControlsMode = 'tap' | 'always' | 'hover';

interface VideoPlayerProps {
  videoId: string;
  onVideoEnd?: () => void;
  onVideoError?: () => void;
  // 동기화 관련 props
  currentUserId?: string;
  syncState?: PlaybackSyncState | null;
  onPlaybackSync?: (state: Omit<PlaybackSyncState, 'syncedAt'>) => void;
  syncEnabled?: boolean;
  /** tap: 모바일, 탭하면 펼치고 3초 후 숨김. always: PC 상시. hover: 시네마 호버 */
  controlsMode?: PlayerControlsMode;
  minimized?: boolean;
  minimizedTitle?: string;
  onRestore?: () => void;
  onPositionShared?: () => void;
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
  syncEnabled = true,
  controlsMode = 'always',
  minimized = false,
  minimizedTitle = '',
  onRestore,
  onPositionShared,
}) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onVideoEndRef = useRef(onVideoEnd);
  const onVideoErrorRef = useRef(onVideoError);
  const onPlaybackSyncRef = useRef(onPlaybackSync);
  
  // 동기화 관련 refs
  const lastSyncTimeRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const lastAppliedSyncRef = useRef<number>(0);
  const progressIntervalRef = useRef<number | null>(null);
  const endCheckTimeoutRef = useRef<number | null>(null);
  const lastPlaybackTimeRef = useRef<number>(0);
  const lastDurationRef = useRef<number>(0);
  const endHandledRef = useRef<boolean>(false);
  
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
    lastPlaybackTimeRef.current = 0;
    lastDurationRef.current = 0;
    endHandledRef.current = false;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (endCheckTimeoutRef.current) {
      clearTimeout(endCheckTimeoutRef.current);
      endCheckTimeoutRef.current = null;
    }

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
          
          const updatePlaybackSnapshot = () => {
            const player = playerRef.current;
            if (!player) return;
            try {
              const currentTime = player.getCurrentTime?.();
              const duration = player.getDuration?.();
              if (typeof currentTime === 'number' && !Number.isNaN(currentTime)) {
                lastPlaybackTimeRef.current = currentTime;
              }
              if (typeof duration === 'number' && !Number.isNaN(duration) && duration > 0) {
                lastDurationRef.current = duration;
              }
            } catch (e) {
              // ignore
            }
          };
          const stopProgressMonitor = () => {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
          };
          const startProgressMonitor = () => {
            if (progressIntervalRef.current) return;
            updatePlaybackSnapshot();
            progressIntervalRef.current = window.setInterval(updatePlaybackSnapshot, 500);
          };
          const handleRealEnd = () => {
            if (endHandledRef.current) return;
            endHandledRef.current = true;
            videoStartedRef.current = false;
            onVideoEndRef.current?.();
          };
          
          // 재생/일시정지 상태 변경시 동기화 브로드캐스트
          if (event.data === 1) { // Playing
            videoStartedRef.current = true; // 비디오가 실제로 재생 시작됨
            errorRetryCountRef.current = 0; // 에러 카운트 리셋
            endHandledRef.current = false;
            startProgressMonitor();
            broadcastSync(true);
          } else if (event.data === 2) { // Paused
            updatePlaybackSnapshot();
            stopProgressMonitor();
            broadcastSync(false);
          } else if (event.data === 3) { // Buffering
            startProgressMonitor();
          } else if (event.data === -1 || event.data === 5) { // Unstarted / Video cued
            stopProgressMonitor();
          }
          
          if (event.data === 0) {
            stopProgressMonitor();
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
                
                const safeDuration = duration > 0 ? duration : lastDurationRef.current;
                const effectiveTime = Math.max(currentTime, lastPlaybackTimeRef.current);
                const minPlayTime = Math.min(10, safeDuration * 0.5);
                const isNearEnd = safeDuration > 0 &&
                  (safeDuration - effectiveTime <= 2 || effectiveTime / safeDuration >= 0.85);
                if (safeDuration > 0 && effectiveTime >= minPlayTime && isNearEnd) {
                  console.log('Video actually ended! Calling onVideoEnd...');
                  handleRealEnd();
                } else {
                  console.log('State 0 received but end not confirmed. Rechecking shortly...');
                  if (endCheckTimeoutRef.current) {
                    clearTimeout(endCheckTimeoutRef.current);
                  }
                  endCheckTimeoutRef.current = window.setTimeout(() => {
                    if (endHandledRef.current) return;
                    const retryPlayer = playerRef.current;
                    if (!retryPlayer) return;
                    try {
                      const retryState = retryPlayer.getPlayerState?.();
                      const retryDuration = retryPlayer.getDuration?.() ?? lastDurationRef.current;
                      const retryTime = retryPlayer.getCurrentTime?.() ?? 0;
                      const retryEffectiveTime = Math.max(retryTime, lastPlaybackTimeRef.current);
                      const retryMinPlay = Math.min(10, retryDuration * 0.5);
                      const retryNearEnd = retryDuration > 0 &&
                        (retryDuration - retryEffectiveTime <= 2 || retryEffectiveTime / retryDuration >= 0.85);
                      if (retryState === 0 && retryDuration > 0 && retryEffectiveTime >= retryMinPlay && retryNearEnd) {
                        console.log('Video end confirmed after delay. Calling onVideoEnd...');
                        handleRealEnd();
                      } else {
                        console.log('End check failed. Assuming ad ended or playback resumed.');
                      }
                    } catch (e) {
                      // ignore
                    }
                  }, 1000);
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
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        if (endCheckTimeoutRef.current) {
          clearTimeout(endCheckTimeoutRef.current);
          endCheckTimeoutRef.current = null;
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
  const [controlsOpen, setControlsOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setControlsOpen(false), 3000);
  }, []);

  const revealControls = useCallback(() => {
    if (controlsMode !== 'tap') return;
    setControlsOpen(true);
    scheduleHide();
  }, [controlsMode, scheduleHide]);

  useEffect(() => () => clearHideTimer(), []);

  useEffect(() => {
    if (controlsMode !== 'tap') {
      clearHideTimer();
      setControlsOpen(false);
    }
  }, [controlsMode]);

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
      
      setSyncFeedback(true);
      setTimeout(() => setSyncFeedback(false), 2000);
      onPositionShared?.();
    } catch (e) {
      console.error('Error manual sync:', e);
    }
  };

  const controlsVisible = !minimized && (
    controlsMode === 'always' ||
    (controlsMode === 'tap' && controlsOpen) ||
    controlsMode === 'hover'
  );

  const barCollapsed = minimized || (controlsMode === 'tap' && !controlsOpen);

  return (
    <div className={controlsMode === 'hover' && !minimized ? 'group/player' : undefined}>
      <div className={`yt-frame relative w-full bg-black overflow-hidden border border-white/10 ${minimized ? 'h-12' : 'aspect-video lg:rounded-t-xl'}`}>
        <div ref={containerRef} className="absolute inset-0" />

        {minimized && (
          <button
            type="button"
            onClick={onRestore}
            className="absolute inset-0 z-20 flex items-center gap-3 px-3 bg-[#111]/95 text-left"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5">
              <Play size={14} className="text-white" fill="currentColor" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-white">{minimizedTitle}</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/15">
              <Play size={14} className="text-white" fill="currentColor" />
            </span>
          </button>
        )}

        {!minimized && controlsMode === 'tap' && !controlsOpen && (
          <button
            type="button"
            aria-label={t('showControls')}
            onClick={revealControls}
            className="absolute inset-0 z-20 cursor-pointer bg-transparent"
          />
        )}
      </div>

      <div
        className={
          controlsMode === 'hover' && !minimized
            ? 'grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 group-hover/player:grid-rows-[1fr]'
            : barCollapsed
              ? 'grid grid-rows-[0fr]'
              : 'grid grid-rows-[1fr]'
        }
        onPointerDown={controlsMode === 'tap' ? scheduleHide : undefined}
      >
        <div className="overflow-hidden">
          {controlsVisible && (
            <div className="flex h-12 items-center gap-1 overflow-x-auto border border-t-0 border-white/10 bg-[#141416] px-1.5 lg:rounded-b-xl">
              <button
                type="button"
                onClick={handleMusicMuteToggle}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10"
                title={isMusicMuted ? '음소거 해제' : '음소거'}
              >
                {isMusicMuted || musicVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                aria-label="volume"
                value={isMusicMuted ? 0 : musicVolume}
                onChange={(e) => {
                  handleMusicVolumeChange(Number(e.target.value));
                  if (controlsMode === 'tap') scheduleHide();
                }}
                className="h-11 w-24 shrink-0 cursor-pointer accent-white sm:w-auto sm:min-w-[88px] sm:flex-1"
              />
              <button
                type="button"
                onClick={handleManualSkip}
                className="flex h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm text-white hover:bg-white/10"
                title={t('skip')}
              >
                <SkipForward size={16} />
                <span>{t('skip')}</span>
              </button>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={!syncEnabled || !currentUserId}
                className={`flex h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm transition-colors ${
                  syncFeedback
                    ? 'bg-[#30D158] text-black'
                    : 'text-white hover:bg-white/10 disabled:text-gray-500'
                }`}
                title={t('sharePosition')}
              >
                <MapPin size={16} />
                <span className="whitespace-nowrap">{t('sharePosition')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

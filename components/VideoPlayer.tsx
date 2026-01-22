import React, { useEffect, useRef, useCallback } from 'react';
import { SkipForward } from 'lucide-react';

interface VideoPlayerProps {
  videoId: string;
  onVideoEnd?: () => void;
  onVideoError?: () => void;
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

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, onVideoEnd, onVideoError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onVideoEndRef = useRef(onVideoEnd);
  const onVideoErrorRef = useRef(onVideoError);

  // Keep refs updated
  useEffect(() => {
    onVideoEndRef.current = onVideoEnd;
    onVideoErrorRef.current = onVideoError;
  }, [onVideoEnd, onVideoError]);

  const initPlayer = useCallback(async () => {
    await loadYouTubeAPI();

    if (!containerRef.current) return;

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
          if (event.data === 0) {
            // 비디오가 실제로 끝났는지 확인 (광고 종료나 버퍼링 문제로 인한 false positive 방지)
            const player = playerRef.current;
            if (player && typeof player.getDuration === 'function' && typeof player.getCurrentTime === 'function') {
              try {
                const duration = player.getDuration();
                const currentTime = player.getCurrentTime();
                console.log(`Video state 0 - Duration: ${duration}s, CurrentTime: ${currentTime}s`);
                
                // 비디오 길이가 있고, 현재 시간이 총 시간의 90% 이상일 때만 끝난 것으로 처리
                // 또는 비디오가 매우 짧은 경우 (10초 미만)는 바로 처리
                if (duration > 0 && (currentTime / duration >= 0.9 || (duration < 10 && currentTime >= duration - 1))) {
                  console.log('Video actually ended! Calling onVideoEnd...');
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
          console.error('YouTube Error:', event.data);
          onVideoErrorRef.current?.();
        },
        onReady: (event: any) => {
          console.log('YouTube Player Ready');
        }
      }
    });
  }, [videoId]);

  useEffect(() => {
    initPlayer();

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        playerRef.current = null;
      }
    };
  }, [videoId, initPlayer]);

  const handleManualSkip = () => {
    onVideoError?.();
  };

  return (
    <div className="relative w-full h-0 pb-[56.25%] bg-black rounded-lg overflow-hidden shadow-2xl border border-brand-gray">
      <div
        ref={containerRef}
        className="absolute top-0 left-0 w-full h-full"
      />

      {/* Skip button overlay */}
      <button
        onClick={handleManualSkip}
        className="absolute bottom-4 right-4 bg-black/70 hover:bg-brand-red text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm z-10"
        title="재생 안되면 클릭해서 스킵"
      >
        <SkipForward size={16} />
        스킵
      </button>
    </div>
  );
};
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, SkipForward } from 'lucide-react';

interface VideoPlayerProps {
  videoId: string;
  onVideoEnd?: () => void;
  onVideoError?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, onVideoEnd, onVideoError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasError, setHasError] = useState(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setHasError(false);

    // Set a timeout to detect if video fails to load
    // YouTube doesn't provide a clean error event, so we use a timeout approach
    errorTimeoutRef.current = setTimeout(() => {
      // Check if iframe is still showing error state
      // This is a fallback - the user can manually skip if video doesn't play
    }, 5000);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        // YouTube IFrame API state: 0 = ended, -1 = unstarted, 5 = cued
        if (data.event === 'onStateChange') {
          if (data.info === 0) {
            onVideoEnd?.();
          }
          // Error states that might indicate playback issues
          if (data.info === -1 || data.info === 5) {
            // Video might have issues, but don't auto-skip immediately
          }
        }

        // Detect error event
        if (data.event === 'onError') {
          setHasError(true);
          onVideoError?.();
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [videoId, onVideoEnd, onVideoError]);

  const handleManualSkip = () => {
    onVideoError?.();
  };

  return (
    <div className="relative w-full h-0 pb-[56.25%] bg-black rounded-lg overflow-hidden shadow-2xl border border-brand-gray">
      <iframe
        ref={iframeRef}
        className="absolute top-0 left-0 w-full h-full"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&enablejsapi=1&rel=0&origin=${window.location.origin}`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>

      {/* Skip button overlay */}
      <button
        onClick={handleManualSkip}
        className="absolute bottom-4 right-4 bg-black/70 hover:bg-brand-red text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
        title="재생 안되면 클릭해서 스킵"
      >
        <SkipForward size={16} />
        스킵
      </button>
    </div>
  );
};
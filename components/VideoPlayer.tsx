import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  videoId: string;
  onVideoEnd?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, onVideoEnd }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // YouTube IFrame API state: 0 = ended
        if (data.event === 'onStateChange' && data.info === 0) {
          onVideoEnd?.();
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onVideoEnd]);

  return (
    <div className="relative w-full h-0 pb-[56.25%] bg-black rounded-lg overflow-hidden shadow-2xl border border-brand-gray">
      <iframe
        ref={iframeRef}
        className="absolute top-0 left-0 w-full h-full"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&enablejsapi=1&rel=0`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
    </div>
  );
};
import React, { useEffect, useRef, useState } from 'react';

interface SceneVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlayEnabled: boolean;
  sceneId: string;
}

export const SceneVideoPlayer: React.FC<SceneVideoPlayerProps> = ({
  src,
  poster,
  autoPlayEnabled,
  sceneId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Reset play state when source changes
    setIsPlaying(false);
  }, [src]);

  useEffect(() => {
    if (!autoPlayEnabled || !src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = videoRef.current;
          if (!video) return;

          if (entry.isIntersecting) {
            // When scrolled into view, play the video (must be muted for browser autoplay policy)
            video.muted = true;
            setIsMuted(true);
            video.play()
              .then(() => {
                setIsPlaying(true);
              })
              .catch((err) => {
                console.warn(`[SceneVideoPlayer] Auto-play failed for ${sceneId}:`, err.message || err);
              });
          } else {
            // When scrolled out of view, pause the video
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: 0.25 // Trigger when 25% of the card is visible
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [autoPlayEnabled, src, sceneId]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black flex items-center justify-center group/player">
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        muted={isMuted}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onVolumeChange={() => {
          if (videoRef.current) {
            setIsMuted(videoRef.current.muted);
          }
        }}
        className="w-full h-full object-cover transition-opacity duration-300"
        poster={poster}
      />
      {/* Muted Auto-play HUD */}
      {isPlaying && isMuted && autoPlayEnabled && (
        <div id={`autoplay-badge-${sceneId}`} className="absolute top-3 right-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md border border-neon-cyan/30 pointer-events-none text-[10px] text-neon-cyan tracking-wider font-mono flex items-center gap-1.5 animate-pulse z-10">
          <span className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-ping"></span>
          自動播放中 (靜音)
        </div>
      )}
    </div>
  );
};

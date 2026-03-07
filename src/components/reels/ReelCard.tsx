import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Reel } from '@/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play, Music } from 'lucide-react';

interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
}

export function ReelCard({
  reel,
  isActive,
  muted,
  onToggleMute,
  liked,
  likeCount,
  commentCount,
  onLike,
  onComment,
  onShare,
}: ReelCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [likeAnim, setLikeAnim] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      video.currentTime = 0;
      setPaused(false);
    }
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    const onTime = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [isActive]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  const handleDoubleTap = () => {
    if (!liked) {
      onLike();
    }
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 800);
  };

  let lastTap = 0;
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      handleDoubleTap();
    } else {
      togglePlay();
    }
    lastTap = now;
  };

  return (
    <div className="relative w-full h-full bg-black select-none">
      <video
        ref={videoRef}
        src={reel.video_url}
        className="w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        onClick={handleTap}
      />

      {/* Pause indicator */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-black/40 rounded-full p-5 backdrop-blur-sm">
            <Play className="h-12 w-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Double-tap like animation */}
      {likeAnim && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <Heart className="h-24 w-24 text-white fill-red-500 animate-ping" />
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-white/20">
        <div
          className="h-full bg-white transition-all duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-6 px-4">
          <div className="flex items-end gap-3">
            {/* Left: user info & caption */}
            <div className="flex-1 min-w-0 space-y-3">
              <Link to={`/profile/${reel.user_id}`} className="flex items-center gap-3 group">
                <div className="relative">
                  <Avatar className="h-11 w-11 ring-2 ring-white/80 group-hover:ring-primary transition-all">
                    <AvatarImage src={reel.profiles?.avatar_url || ''} />
                    <AvatarFallback className="bg-white/20 text-white text-sm font-bold">
                      {reel.profiles?.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-white font-semibold text-[15px] drop-shadow-lg">
                  {reel.profiles?.full_name || reel.profiles?.username}
                </span>
              </Link>

              {reel.caption && (
                <p className="text-white/90 text-sm leading-relaxed max-w-[260px] drop-shadow-md line-clamp-2">
                  {reel.caption}
                </p>
              )}

              {/* Music indicator */}
              <div className="flex items-center gap-2 text-white/70 text-xs">
                <Music className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
                <span className="truncate max-w-[180px]">Original Audio</span>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex flex-col items-center gap-5 pb-1">
              <button
                className="flex flex-col items-center gap-1 group"
                onClick={onLike}
              >
                <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-all group-active:scale-90">
                  <Heart
                    className={`h-7 w-7 transition-all ${
                      liked
                        ? 'fill-red-500 text-red-500 scale-110'
                        : 'text-white group-hover:scale-110'
                    }`}
                  />
                </div>
                <span className="text-white text-xs font-medium drop-shadow-md">
                  {likeCount > 0 ? likeCount.toLocaleString() : ''}
                </span>
              </button>

              <button
                className="flex flex-col items-center gap-1 group"
                onClick={onComment}
              >
                <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-all group-active:scale-90">
                  <MessageCircle className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-white text-xs font-medium drop-shadow-md">
                  {commentCount > 0 ? commentCount.toLocaleString() : ''}
                </span>
              </button>

              <button
                className="flex flex-col items-center gap-1 group"
                onClick={onShare}
              >
                <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-all group-active:scale-90">
                  <Share2 className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
                </div>
              </button>

              <button
                className="flex flex-col items-center gap-1 group"
                onClick={onToggleMute}
              >
                <div className="p-2 rounded-full bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-all group-active:scale-90">
                  {muted ? (
                    <VolumeX className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
                  ) : (
                    <Volume2 className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

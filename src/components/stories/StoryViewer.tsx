import { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: Profile;
}

interface GroupedStories {
  user: Profile;
  stories: Story[];
  hasUnviewed: boolean;
}

interface StoryViewerProps {
  storyGroup: GroupedStories;
  currentUser: Profile | null;
  onClose: () => void;
  onStoryViewed: () => void;
}

const STORY_DURATION = 5000; // 5 seconds for images

export default function StoryViewer({ 
  storyGroup, 
  currentUser, 
  onClose,
  onStoryViewed 
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentStory = storyGroup.stories[currentIndex];

  const markAsViewed = useCallback(async (storyId: string) => {
    if (!currentUser || storyGroup.user.id === currentUser.id) return;
    
    await supabase
      .from('story_views')
      .upsert({
        story_id: storyId,
        viewer_id: currentUser.id,
      }, {
        onConflict: 'story_id,viewer_id'
      });
    
    onStoryViewed();
  }, [currentUser, storyGroup.user.id, onStoryViewed]);

  const goToNext = useCallback(() => {
    if (currentIndex < storyGroup.stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, storyGroup.stories.length, onClose]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  useEffect(() => {
    markAsViewed(currentStory.id);
  }, [currentStory.id, markAsViewed]);

  useEffect(() => {
    if (isPaused || currentStory.media_type === 'video') return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNext();
          return 0;
        }
        return prev + (100 / (STORY_DURATION / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, currentStory.media_type, goToNext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToPrev();
      if (e.key === 'ArrowLeft') goToNext();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(p => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  const handleVideoEnded = () => {
    goToNext();
  };

  const timeAgo = formatDistanceToNow(new Date(currentStory.created_at), { 
    addSuffix: true, 
    locale: ar 
  });

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Navigation Areas */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-1/3 z-40 cursor-pointer"
        onClick={goToPrev}
      />
      <div 
        className="absolute left-0 top-0 bottom-0 w-1/3 z-40 cursor-pointer"
        onClick={goToNext}
      />

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
          onClick={goToPrev}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}
      {currentIndex < storyGroup.stories.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
          onClick={goToNext}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Story Content */}
      <div className="relative w-full max-w-md h-[80vh] bg-black rounded-lg overflow-hidden">
        {/* Progress Bars */}
        <div className="absolute top-2 left-2 right-2 z-30 flex gap-1">
          {storyGroup.stories.map((_, index) => (
            <div 
              key={index} 
              className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
            >
              <div 
                className="h-full bg-white transition-all duration-100"
                style={{ 
                  width: index < currentIndex 
                    ? '100%' 
                    : index === currentIndex 
                      ? `${progress}%` 
                      : '0%' 
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between" dir="rtl">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-white">
              <AvatarImage src={storyGroup.user.avatar_url || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {storyGroup.user.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white font-semibold text-sm">
                {storyGroup.user.full_name || storyGroup.user.username}
              </p>
              <p className="text-white/70 text-xs">{timeAgo}</p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setIsPaused(p => !p)}
          >
            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </Button>
        </div>

        {/* Media */}
        {currentStory.media_type === 'image' ? (
          <img
            src={currentStory.media_url}
            alt="Story"
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            src={currentStory.media_url}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            onEnded={handleVideoEnded}
            onPause={() => setIsPaused(true)}
            onPlay={() => setIsPaused(false)}
          />
        )}

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-4 left-4 right-4 z-30">
            <p className="text-white text-center bg-black/50 rounded-lg p-3 backdrop-blur-sm" dir="rtl">
              {currentStory.caption}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
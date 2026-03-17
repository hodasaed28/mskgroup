import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import CreateStoryDialog from './CreateStoryDialog';
import StoryViewer from './StoryViewer';
import { useLanguage } from '@/hooks/useLanguage';

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

interface StoriesBarProps {
  currentUser: Profile | null;
}

export default function StoriesBar({ currentUser }: StoriesBarProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [groupedStories, setGroupedStories] = useState<GroupedStories[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<GroupedStories | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) {
      fetchStories();
    }
  }, [currentUser]);

  const fetchStories = async () => {
    const { data: stories } = await supabase
      .from('stories')
      .select('*, profiles(*)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (stories && currentUser) {
      // Get viewed stories
      const { data: viewedStories } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', currentUser.id);

      const viewedIds = new Set(viewedStories?.map(v => v.story_id) || []);

      // Group stories by user
      const grouped: Record<string, GroupedStories> = {};
      
      (stories as unknown as Story[]).forEach(story => {
        if (!grouped[story.user_id]) {
          grouped[story.user_id] = {
            user: story.profiles,
            stories: [],
            hasUnviewed: false
          };
        }
        grouped[story.user_id].stories.push(story);
        if (!viewedIds.has(story.id)) {
          grouped[story.user_id].hasUnviewed = true;
        }
      });

      // Sort: current user first, then by most recent story
      const sortedGroups = Object.values(grouped).sort((a, b) => {
        if (a.user.id === currentUser.id) return -1;
        if (b.user.id === currentUser.id) return 1;
        return new Date(b.stories[0].created_at).getTime() - new Date(a.stories[0].created_at).getTime();
      });

      setGroupedStories(sortedGroups);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="bg-card rounded-lg p-4 shadow-sm mb-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 shadow-sm"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-10 py-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Create Story Button */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="relative w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-primary/50 hover:border-primary transition-colors"
            >
              {currentUser?.avatar_url ? (
                <>
                  <Avatar className="w-full h-full">
                    <AvatarImage src={currentUser.avatar_url} />
                    <AvatarFallback>{currentUser.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Plus className="h-4 w-4 text-primary-foreground" />
                  </div>
                </>
              ) : (
                <Plus className="h-6 w-6 text-primary" />
              )}
            </button>
            <span className="text-xs text-muted-foreground">{t('stories.yourStory')}</span>
          </div>

          {/* Stories */}
          {groupedStories
            .filter(g => g.user.id !== currentUser?.id)
            .map((group) => (
              <div 
                key={group.user.id} 
                className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
                onClick={() => setSelectedStoryGroup(group)}
              >
                <div className={`p-0.5 rounded-full ${group.hasUnviewed ? 'bg-gradient-to-tr from-yellow-400 to-pink-500' : 'bg-muted'}`}>
                  <Avatar className="w-16 h-16 border-2 border-background">
                    <AvatarImage src={group.user.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {group.user.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-[64px]">
                  {group.user.username}
                </span>
              </div>
            ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 shadow-sm"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <CreateStoryDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        currentUser={currentUser}
        onStoryCreated={fetchStories}
      />

      {selectedStoryGroup && (
        <StoryViewer
          storyGroup={selectedStoryGroup}
          currentUser={currentUser}
          onClose={() => setSelectedStoryGroup(null)}
          onStoryViewed={fetchStories}
        />
      )}
    </div>
  );
}

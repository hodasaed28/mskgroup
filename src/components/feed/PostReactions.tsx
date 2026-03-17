import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

interface PostReactionsProps {
  postId: string;
  currentUser: Profile | null;
  onReactionChange?: () => void;
}

export function PostReactions({ postId, currentUser, onReactionChange }: PostReactionsProps) {
  const { t } = useTranslation();

  const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
    { type: 'like', emoji: '👍', label: t('reactions.like') },
    { type: 'love', emoji: '❤️', label: t('reactions.love') },
    { type: 'haha', emoji: '😂', label: t('reactions.haha') },
    { type: 'wow', emoji: '😮', label: t('reactions.wow') },
    { type: 'sad', emoji: '😢', label: t('reactions.sad') },
    { type: 'angry', emoji: '😡', label: t('reactions.angry') },
  ];

  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<ReactionType, number>>({ like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => { fetchReactions(); }, [postId, currentUser]);

  const fetchReactions = async () => {
    const { data } = await supabase.from('post_reactions').select('reaction, user_id').eq('post_id', postId);
    if (data) {
      const counts: Record<ReactionType, number> = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
      data.forEach((r) => {
        counts[r.reaction as ReactionType]++;
        if (currentUser && r.user_id === currentUser.id) setUserReaction(r.reaction as ReactionType);
      });
      setReactionCounts(counts);
    }
  };

  const handleReaction = async (reactionType: ReactionType) => {
    if (!currentUser) return;
    if (userReaction === reactionType) {
      await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', currentUser.id);
      setUserReaction(null);
      setReactionCounts((prev) => ({ ...prev, [reactionType]: prev[reactionType] - 1 }));
    } else {
      if (userReaction) {
        await supabase.from('post_reactions').update({ reaction: reactionType }).eq('post_id', postId).eq('user_id', currentUser.id);
        setReactionCounts((prev) => ({ ...prev, [userReaction]: prev[userReaction] - 1, [reactionType]: prev[reactionType] + 1 }));
      } else {
        await supabase.from('post_reactions').insert({ post_id: postId, user_id: currentUser.id, reaction: reactionType });
        setReactionCounts((prev) => ({ ...prev, [reactionType]: prev[reactionType] + 1 }));
      }
      setUserReaction(reactionType);
    }
    setIsOpen(false);
    onReactionChange?.();
  };

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
  const topReactions = REACTIONS.filter((r) => reactionCounts[r.type] > 0).sort((a, b) => reactionCounts[b.type] - reactionCounts[a.type]).slice(0, 3);
  const currentReactionEmoji = userReaction ? REACTIONS.find((r) => r.type === userReaction)?.emoji : null;

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('gap-2', userReaction && 'text-destructive')}>
            {currentReactionEmoji ? <span className="text-lg">{currentReactionEmoji}</span> : <Heart className={cn('h-5 w-5', userReaction && 'fill-current')} />}
            {t('feed.like')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top">
          <div className="flex gap-1">
            {REACTIONS.map((reaction) => (
              <Button key={reaction.type} variant="ghost" size="sm" className={cn('text-2xl h-10 w-10 p-0 hover:scale-125 transition-transform', userReaction === reaction.type && 'bg-muted')} onClick={() => handleReaction(reaction.type)} title={reaction.label}>
                {reaction.emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {totalReactions > 0 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <div className="flex -space-x-1">{topReactions.map((r) => <span key={r.type} className="text-sm">{r.emoji}</span>)}</div>
          <span>{totalReactions}</span>
        </div>
      )}
    </div>
  );
}
